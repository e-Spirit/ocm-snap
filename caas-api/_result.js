/**
 * @typedef {Object} CaasResponse - Provides api to handle paging
 * @description Represents a response from CaaS and provides multiple handles to retrieve data depending on whether
 * paging was used in the request or not.
 * @property {Function} getPage
 * @property {Function} first 
 * @property {Function} next
 * @property {Array<Object>} data
 */

/*
Internal documentation:

This function returns an api for paging if paging was requested. It's called from within the caas.get function
and returns a CaasResponse object with handles for paging. 
These functions call the fetchPage callback function which takes a page and an optional pagesize as parameters and 
returns a Promise containing the data from that page
*/
const CaasResponse = function(fetchPage, pageLimit){
    /**
     * @alias CaasResponse.data
     * @description Contains one or more documents from CaaS. It is only contained if paging was not used in the request.
     * @type {Array<Object>}
     */
    let data = {}

    //this function returns an iterator that generates increasing integers until the page limit is reached
    const _pageGenerator = function*(start, limit){
        let page = start;
        if(limit){
            while(page < limit) yield page++
        }
        else{
            while(true) yield page++
        }
    }

    let pageIterator
    let lockedPagesize

    /**
     * @alias CaasResponse.getPage
     * @async
     * @description Gets a page of documents from CaaS. This can be called independently of first and next and provides
     * an alternative way of using paging.
     * @param {Number} page - The pagenumber to get from CaaS
     * @param {Number} [pagesize] - The number of documents to get for this page.
     * If nothing is passed, the pagesize set in CaasOptions.paging is used.
     * @returns {Promise<Object>} Data containing one or multiple documents from CaaS
     */
    const _fetchPage = (page, pagesize) => {
        return fetchPage(page, pagesize)
    }
    /**
     * @alias CaasResponse.first
     * @async
     * @description Fetches the first pagesize amount of documents matching the query that created this
     * instance of CaasResponse. Also locks the pagesize for subsequent calls of next()
     * @param {Number} [pagesize] - The number of documents to get from CaaS. 
     * If nothing is passed, the pagesize set in CaasOptions.paging is used.
     * @returns {Promise<Object>} Data containing one or multiple documents from CaaS
     */
    const _fetchFirst = (pagesize)=>{
        pageIterator = _pageGenerator(2, pageLimit)
        lockedPagesize = pagesize

        return _fetchPage(1, lockedPagesize)
    }
    /**
     * @alias CaasResponse.next
     * @async
     * @description Gets the next documents from CaaS. The amount of documents retrieved is either determined by setting
     * the paging.pagesize property of the caas options. Or by calling first with a pagesize.
     * @returns {Promise<Object>} Data containing one or multiple documents from CaaS
     */
    const _fetchNext = () => {
        if(pageIterator){
            return _fetchPage(pageIterator.next().value, lockedPagesize)
        }
        pageIterator = _pageGenerator(1, pageLimit)
        return _fetchPage(pageIterator.next().value, lockedPagesize)
    }

    return {
        getPage: _fetchPage,    //We could return fetchPage (the function param) at this point, but added _fetchPage for JSDoc
        first: _fetchFirst, 
        next: _fetchNext,
        data: data              //We could return nothing instead but added this for JSDoc
    }
}
export default CaasResponse