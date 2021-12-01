import * as util from './_util.js'
import CaasResponse from './_result.js'

/**
 * @typedef caas
 * @property {Function} get
 * @property {Function} use
 * @description Represents an api handle for asynchronous http-calls to CaaS. <br>
 * <b> Example usages: </b>
 * <pre><code>
 * let response = await caas.get({ host: "example.com", apikey: "example-apikey", project: "example" }, "tutorials", { fs_language: "EN" })
 * let data = response.data
 * </code></pre>
 * This would get all english-language tutorial documents from the project <i>example</i> 
 * located at http://example.com/ using the example-apikey
 * 
 * <pre><code>
 * let myCaas = caas.use({ host: "https://example.com", apikey: "another-apikey", project: "example" })
 * let response = await myCaas.get("tutorials", { and: [ { fs_language: "EN" }, { title: "Concatenating queries using 'and'" } ] })
 * let data = response.data
 * </code></pre>
 * This would get all english-language tutorial documents with the title <i>Concatenating queries using 'and'</i> 
 * from the project <i>example</i>. Note, that in this example, every call of <code>myCaas.get()</code>
 * would call the same instance of CaaS
 * 
 * <pre><code>
 * let myCaas = caas.use({ host: "https://example.com", apikey: "another-apikey", project: "example", paging: true })
 * let response = await myCaas.get("tutorials")
 * let data = response.first(3)
 * </code></pre>
 * This would get the first 3 tutorial documents from the <i>example</i> project
 */
const caas = (function(){

    const _assembleURL = (options, collection, query) => {
        if(!util.checkOptions(options) || !util.checkFilter(query)){
            return
        }

        let page, pagesize
        if(typeof options.paging === "object"){
            ({page, pagesize} = options.paging)
        } else {
            page = 1
            pagesize = 1
        }
        
        let collectionUrl = (collection ? "/" : "") + collection
        let url
        url = new URL(`${util.protocolizeHost(options.host)}/${options.project}${collectionUrl}`)
        url = util.attachParam(url, util.makeFilterString(query))
        if(options.paging){
            url = util.attachParam(url, util.getPagingParams(page, pagesize))
        } else {
            url = util.attachParam(url, "rep=pj&np")
        }

        return url
    }

    const _fetchFromCaaS = async(url, apikey) => {

        let req = new Request(url, {
            method: 'GET',
            headers: {
                Authorization: `apikey="${apikey}"`
            }
        })

        let response = await fetch(req)
        if(response.status === 404){
            return null
        }
        if(response.status === 403){
            throw new Error('Invalid apikey')
        }

        return await response.json()
    }

    //this does all the hard work
    const _handleRequest = async (options, collection, query) => {
        
        let data = await _fetchFromCaaS(_assembleURL(options, collection, query), options.apikey)
        if(!data){
            return null
        }
        let result = {}
        if(!options.paging){
            result.data = data
        }
        else {
            let limit = data._total_pages || null
            let fetchPage = (page, pagesize=options.paging.pagesize) => {
                //deep copy of options object
                let optionswithpaging = JSON.parse(JSON.stringify(options))
                optionswithpaging.paging = {page: page, pagesize: pagesize}

                let url = _assembleURL(optionswithpaging, collection, query)
                url = util.attachParam(url, "rep=pj&np")
                return _fetchFromCaaS(url, optionswithpaging.apikey)
            }

            result = CaasResponse(fetchPage, limit)
        }

        return result
    }

    /**
    * @alias caas.get
    * @async
    * @description Returns all documents from CaaS matching the given query
    * @param {CaasOptions} options  - Contains options to use for the CaaS request.
    * @param {string} [collection]  - The name of the collection in CaaS. This parameter is optional and get will return a list
    * of collections if unused. If no collection is passed, but a query is passed, get() will throw an error.
    * @param {Object} [query]       - The filter query to be used by the CaaS, it can contain an array or a single 
    * key-value pair representing one equals query. This parameter is optional and get() will return all documents in a collection
    * if no query is passed. If no collection is passed but a query is passed, get() will throw an error.
    * @param {array} query.and      - This array may contain key-value pairs representing a query
    * @param {*} query.key          - Key can be of any type and the value can be of any type. 
    * The given key-value pair will be used in the request to match the data stored in CaaS. <br><br>
    * <b>
    * Example query without and-concatenations
    * </b>
    * <pre><code>
    * {
    *      fs_id: "homepage"
    * }
    * </code></pre>
    * This will find all documents where the key fs_id equals homepage. <br><br>
    * <b>Example query with and-concatenations</b>
    * <pre><code>
    * {
    *   and: [
    *       {fs_id: "homepage"},
    *       {fs_language: "EN"}
    *   ]
    * }
    * </code></pre>
    * This will find all documents where the key fs_id equals homepage <b>and</b> where the fs_language equals EN.
    * @returns {Promise<CaasResponse>}
    */
    const get = (options, collection="", query) => {
        if(typeof collection === 'object' && !query){
            throw new Error(`Invalid parameter: collection cannot be an object, you cannot pass a query without passing a collection to get`)
        }
        return _handleRequest(options, collection, query)
    }

  /**
   * @alias caas.getByIdAndLanguage
   * @async
   * @description Returns all documents from CaaS matching the given fs_id and fs_language attribute
   * @param {CaasOptions} options  - Contains options to use for the CaaS request.
   * @param {string} [collection]  - The name of the collection in CaaS. This parameter is optional and get will return a list
   * of collections if unused. If no collection is passed, but a query is passed, get() will throw an error. <br><br>
   * @returns {Promise<CaasResponse>}
   */
  const getByIdAndLanguage = (options, collection="", fs_id, fs_language) => {
    let query = {
        and: [
            {fs_id: fs_id},
            {fs_language: fs_language}
        ]
    }
    return get(options, collection, query)
  }

    /**
    * @alias caas.use
    * @param {CaasOptions} options - Contains options to use for the CaaS request.
    * @returns {caas} A new caas object where the given options are preset and used in every call of get() and getFirst()
    */
    const use = (options) => {
        return {
        	get: (collection="", query) => get(options, collection, query),
        	use: use,
          getByIdAndLanguage: (collection="", fs_id, fs_language) => getByIdAndLanguage(options, collection, fs_id, fs_language)
        }
    }

    return {get, use, getByIdAndLanguage}
}());
export default caas

/**
* @typedef {Object} CaasOptions
* @description Contains options to use for the CaaS request.
* @property {String} host               - The hostname of the CaaS with or without protocol (defaults to http)
* @property {String} apikey             - The apikey to use for the request
* @property {String} project            - The name of the CaaS-project
* @property {Object|Boolean} [paging]   - If this property exists, paging will be used for the request
* @property {Number} paging.page        - The page number to get
* @property {Number} paging.pagesize    - The amount of entries per page
*/
const CaasOptions = {
    host: "",
    apikey: "",
    project: "",
    paging: {
        page: 1,
        pagesize: 1
    }
}
