const DEFAULT_PROTOCOL = "http"

export const checkOptions = (options) => {
    const mustHaveProps = ['host', 'apikey', 'project']
    if(typeof options !== 'object'){
        throw new Error(`Invalid parameter: options must be an object with the following properties: ${mustHaveProps.join(', ')}`)
    }
    mustHaveProps.forEach(prop => {
        if(!options.hasOwnProperty(prop)){
            throw new Error(`Invalid parameter: options is missing the ${prop} parameter`)
        }
    })
    return true
}

export const protocolizeHost = (host) => {
    let protocolizedHost = ""
    if(host.includes("://")){
        let protocol = new URL(host).protocol
        if(protocol === "http:" || protocol === "https:"){
            protocolizedHost = host
        }
        else {
            throw new Error(`Invalid parameter: host protocol ${protocol} is invalid, only http or https are allowed`)
        }
    }
    else {
        protocolizedHost = DEFAULT_PROTOCOL + "://" + host
    }
    return protocolizedHost
}

const _objectToEqualsQuery = (obj) => {
    let expression = ""
    let keys = Object.keys(obj)
    if(keys.length > 1){
        throw new Error(`Invalid parameter: a query object may only have one property`)
    }
    keys.forEach(key => {
        expression += `{'${key}':'${obj[key]}'}` 
    })
    return expression
}
export const getPagingParams = (page, pagesize) => {
    return `page=${page}&pagesize=${pagesize}`
}
export const makeFilterString = (filter) => {
    let filterstring = ""
    if(filter){
        if(filter.hasOwnProperty('and')){
            filterstring=`filter={'$and':[${filter.and.map(queryObj => _objectToEqualsQuery(queryObj))}]}`
        }
        else {
            filterstring=`filter=${_objectToEqualsQuery(filter)}`
        }
    }
    return filterstring
}
const _hasParams = (url) => {
    if(url.toString().includes('?')){
        return true
    }
    return false
}
export const attachParam = (url, param) => {
    if(param){
        return url + (_hasParams(url) ? "&" : "?") + param 
    }
    return url
}
//validates the filter query
export const checkFilter = (query) => {
    if(query){
        if(typeof query !== 'object'){
            throw new Error(`Invalid parameter: query parameter must be an object`)
        }
        if(query.hasOwnProperty('and')){
            if(!Array.isArray(query.and)){
                throw new Error(`Invalid parameter: query.and must be an array`)
            }
        }
        Object.keys(query).forEach(key => {
            if(Array.isArray(query[key]) && key !== 'and'){
                throw new Error(`Invalid parameter: array properties must be called and`)
            }
        })
    }
    return true
}