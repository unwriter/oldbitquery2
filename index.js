const iconv = require('iconv-lite')
const MongoClient = require('mongodb').MongoClient
const traverse = require('traverse')
const dbTypes = ["unconfirmed", "confirmed"]
const ops = ["find", "aggregate", "sort", "project", "limit", "distinct"]
var db, client
var timeout = null
var validate = function(r) {
  if (typeof r.v === 'undefined') {
    return { status: "invalid", result: false, errors: ["v missing"] }
  }
  if (typeof r.q === 'undefined') {
    return { status: "invalid", result: false, errors: ['q missing'] }
  }
  let keys = Object.keys(r.q)
  if (keys.length === 0) {
    return { status: "invalid", result: false, errors: ['q empty'] }
  }
  let errors = []
  for (let i=0; i<keys.length; i++) {
    if (ops.indexOf(keys[i]) < 0) {
      errors.push("invalid MongoDB op(supported: find, aggregate, sort, project, limit, distinct)")
      return { status: "invalid", result: false, errors: errors }
    }
  }
  return { status: "valid", result: true }
}
var read = async function(r) {
  let isvalid = validate(r)
  if (!isvalid.result) return isvalid;

  let result = {}
  // 1. v: version
  // 2. e: encoding
  // 3. q: query
  if (r.q) {
    let query = r.q
    let encoding = r.e
    if (query.find) {
      query.find = encode(query.find, encoding)
    } else if (query.aggregate) {
      query.aggregate = encode(query.aggregate, encoding)
    }
    let promises = []
    console.log("query = ", query)
    console.log("encoding = ", encoding)

    let src = (query.db && query.db.length > 0) ? query.db : dbTypes
    for (let i=0; i<src.length; i++) {
      let key = src[i]
      if (dbTypes.indexOf(key) >= 0) {
        promises.push(lookup({ request: query, encoding: encoding }, key))
      }
    }

    try {
      let responses = await Promise.all(promises)
      responses.forEach(function(response) {
        result[response.name] = response.items
      })
    } catch (e) {
      console.log("Error", e)
      if (result.errors) {
        result.errors.push(e.toString())
      } else {
        result.errors = [e.toString()]
      }
    }
  }
  return result
}
var exit = function() {
  client.close()
}
var init = function(config) {
  return new Promise(function(resolve, reject) {
    let url = (config && config.url ? config.url : "mongodb://localhost:27017")
    let name = (config && config.name ? config.name : "bitdb")
    let sockTimeout = (config && config.timeout) ? config.timeout + 100 : 20100
    if (/mongodb:.*/.test(url)) {
      MongoClient.connect(url, {
        useNewUrlParser: true,
        socketTimeoutMS: sockTimeout
      }, function(err, _client) {
        if (err) console.log(err)
        client = _client
        if (config && config.timeout) {
          timeout = config.timeout
        }
        db = client.db(name)
        resolve({ read: read, exit: exit })
      })
    } else {
      reject("Invalid Node URL")
    }
  })
}
var lookup = function(r, collectionName) {
  let collection = db.collection(collectionName)
  let query = r.request
  return new Promise(async function(resolve, reject) {
    let cursor
    if (query.find || query.aggregate) {
      if (query.find) {
        cursor = collection.find(query.find, { allowDiskUse:true })
      } else if (query.aggregate) {
        cursor = collection.aggregate(query.aggregate, { allowDiskUse:true })
      }
      if (query.sort) {
        cursor = cursor.sort(query.sort)
      } else {
        cursor = cursor.sort({'blk.i': -1})
      }
      if (query.project) {
        cursor = cursor.project(query.project)
      }
      if (query.limit) {
        cursor = cursor.limit(query.limit)
      } else {
        cursor = cursor.limit(100)
      }
      if (timeout) {
        cursor = cursor.maxTimeMS(timeout)
      }

      cursor.toArray(function(err, docs) {
        if (err) {
          reject(err)
        } else {
          let res = docs;
          if (r.encoding) {
            res = decode(docs, r.encoding)
          }
          console.log(collectionName, "res = ", res)
          resolve({
            name: collectionName,
            items: res
          })
        }
      })

    } else if (query.distinct) {
      if (query.distinct.field) {
        try {
          let items = await collection.distinct(query.distinct.field, query.distinct.query, query.distinct.options)
          let res = items
          if (r.encoding) {
            res = decode(docs, r.encoding)
          }
          resolve({
            name: collectionName,
            items: res
          })
        } catch (e) {
          reject(e)
        }
      }
    }
  })
}
var encode = function(subtree, encoding_schema) {
  let copy = subtree
  traverse(copy).forEach(function(token) {
    if (this.isLeaf) {
      let encoding = "utf8"
      let newVal = token
      let node = this
      if (/^([0-9]+|\$).*/.test(node.key)) {
        while(!node.isRoot) {
          node = node.parent
          if (/^(in|out)\.b[0-9]+/.test(node.key)) {
            break
          }
        }
      }

      if (encoding_schema && encoding_schema[node.key]) {
        encoding = encoding_schema[node.key]
      }

      if (/^(in|out)\.b[0-9]+/.test(node.key)) {
        newVal = iconv.encode(token, encoding).toString("base64")
      }
      this.update(newVal)
    }
  })
  return copy
}
var decode = function(subtree, encoding_schema) {
  let copy = subtree
  console.log("copy = ", copy)
  traverse(copy).forEach(function(token) {
    if (this.isLeaf) {
      let encoding = "base64"
      let newVal = token
      let node = this
      if (/^([0-9]+|\$).*/.test(node.key)) {
        while(!node.isRoot) {
          node = node.parent
          if (/^(in|out)\.b[0-9]+/.test(node.key)) {
            break
          }
        }
      }
      let currentKey = node.path.filter(function(p) {
        return !/^[0-9]+$/.test(p)
      }).join(".")
      if (encoding_schema && encoding_schema[currentKey]) {
        encoding = encoding_schema[currentKey]
      }
      if (/^b[0-9]+/.test(node.key)) {
        newVal = iconv.encode(token, "base64").toString(encoding)
      }
      this.update(newVal)
    }
  })
  return copy
}
module.exports = {
  init: init,
  exit: exit,
  read: read,
  validate: validate
}
