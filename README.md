# Bitquery

---

# (Deprecated. Check out Bitqueryd)

---

Bitquery is a JavaScript library that lets you query a BitDB node.

# Prerequiesites

Bitquery is a query engine that directly interfaces with a BitDB node. You must have access to a BitDB node through either a local or remote MongoDB URL.

> This library is for connecting directly to a BitDB MongoDB instance, and is not for HTTP access. If you're looking for a public HTTP endpoint, this library is not what you're looking for. You can instead use the HTTP-based API endpoint at [bitdb.network](https://bitdb.network), which takes only a couple of minutes to get your app up and running.

# Install

```
npm install --save bitquery
```

# Usage

First initialize, and use the returned db object to make the query. 

## 1. Using Promises


```
var bitquery = require('bitquery')
var bql = {
  "request": {
    "encoding": {
      "output.b0": "hex"
    },
    "find": {
      "output.b0": "6d02"
    },
    "sort": {
      "output.b1": 1
    },
    "limit": 50
  },
  "response": {
    "encoding": {
      "output.b0": "hex",
      "output.b1": "utf8",
      "output.b2": "hex"
    }
  }
}
bitquery.init().then(function(db) {
  db.read(bql).then(function(response) {
    console.log("Response = ", response)
  })
})
```

## 2. Using Async-Await

```
var bitquery = require('bitquery')
var bql = {
  "request": {
    "encoding": {
      "output.b0": "hex"
    },
    "find": {
      "output.b0": "6d02"
    },
    "sort": {
      "output.b1": 1
    },
    "limit": 50
  },
  "response": {
    "encoding": {
      "output.b0": "hex",
      "output.b1": "utf8",
      "output.b2": "hex"
    }
  }
};
(async function () {
  let db = await bitquery.init();
  let response = await db.read(bql);
  console.log("Response = ", response)
})();
```

> Note: By default bitquery connects to `mongodb://localhost:27017` so you don't need to configure anything if you set up BitDB without changing anything.

# BitDB Query Language

BitDB Query Language is a meta query language that builds on top of MongoDB query language, which means it supports 100% of all MongoDB operations.

Learn more here: ___

# Configuration

You can set the following two options:

1. **url:** BitDB Node URL
2. **timeout:** Request timeout

## 1. url

Select the BitDB URL to connect to. 

```
bitquery.init({
  url: "mongodb://localhost:27017"
}).then(function(db) {
  ...
})
```

## 2. timeout

Set request timeout in milliseconds. All BitDB requests will time out after this duration.

```
bitquery.init({
  timeout: 20000
}).then(function(db) {
  ...
})
```

# Bitdb Query Language

The query language is a meta language built on top of MongoDB's own query language, which means 100% of MongoDB's queries are supported.

Top level attributes:

- v: version (default is 2)
- e: encoding (declare the encoding of each query attribute)
- q: query (MongoDB query)

