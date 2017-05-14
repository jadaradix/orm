"use strict";

let doDebug = true;
const debug = {
  "enable": () => {
    doDebug = true;
  },
  "disable": () => {
    doDebug = false;
  },
  "setEnabled": (enabled) => {
    doDebug = enabled;
  },
  "getEnabled": () => {
    return doDebug;
  }
};

const async = require("async");
const path = require("path");
const sqlite3 = require("sqlite3");
const ueber = require("ueber");
const _s = require("underscore.string");

let databases = {};
let defaultDatabaseKey = null;
let currentDatabaseThing = null;

const abstraction = {};
module.exports = abstraction;

const objectError = function objectError (err, callback) {
  return callback({
    "statusCode": 500,
    "statusMessage": err.toString()
  });
};

const parameterWork = function parameterWork (parameters, preparedMode) {
  preparedMode = (preparedMode === undefined ? false : preparedMode);
  return parameters.map(function (parameter) {
    return ((preparedMode === true) ? "?" : "'" + _s.replaceAll(parameter, "'", "''") + "'");
  }).join(", ");
};

const updateWork = function updateWork (map, preparedMode) {
  if (preparedMode === true) {
    return Object.keys(map).map(function (key) {
      return (key + " = ?");
    }).join(", ");
  } else {
    return Object.keys(map).map(function (key) {
      return (key + "=" + (typeof map[key] === "number" ? map[key].toString() : "'" + map[key].toString() + "'"));
    }).join(", ");
  }
};

const whereWork = function whereWork (map) {
  Object.keys(map).forEach((mapKey) => {
    if (map[mapKey] === undefined) delete map[mapKey];
  });
  if (Object.keys(map).length === 0) return "";
  Object.keys(map)
  return " WHERE " +
  Object.keys(map).map(function (key) {
    let v = (map[key] === null ? 'IS NULL' : map[key].toString());
    let string = _s.replaceAll(v, "'", "''");
    return ((
      (v.indexOf("IN") === 0) ||
      (v.indexOf("NOT IN") === 0) ||
      (v.indexOf("IS NULL") === 0) ||
      (v.indexOf("IS NOT NULL") === 0)
    ) ? (key + " " + v) : (key + "=" + (typeof map[key] === "string" ? "'" + string + "'" : string)));
  }).join(" AND ");
};

const getLastIdAssignableObject = function getLastIdAssignableObject (database, table, callback) {
  let sql = "SELECT seq FROM sqlite_sequence WHERE name='" + table + "';";
  if (debug.getEnabled()) console.log(sql);
  return databases[database].thing.get(sql, function (err, result) {
    if (err) return objectError("getLastIdAssignableObject failed selecting seq FROM sqlite_sequence for table '" + table + "'.", callback);
    if (result === undefined) {
      return objectError("getLastIdAssignableObject failed because result was undefined. There is probably not an 'auto increment' column on table '" + table + "'.", callback);
    }
    return callback(false, {
      "lastInsertId": result.seq
    });
  });
};

abstraction.temporarySetDatabase = function temporarySetDatabase (lDatabaseKey) {
  if (debug.getEnabled()) console.log("temporarySetDatabase called; switching to " + lDatabaseKey);
  if (lDatabaseKey === null) {
    currentDatabaseThing = null;
    return;
  } else if (!(lDatabaseKey in databases)) {
    console.warn("Attempt made to temporarySetDatabase with an lDatabaseKey that is not in databases. Setting currentDatabaseThing to null. Did you call ds.init() and choose the right database name?");
    currentDatabaseThing = null;
    return;
  }
  currentDatabaseThing = databases[lDatabaseKey].thing;
};

abstraction.temporaryResetDatabase = function temporaryResetDatabase () {
  if (debug.getEnabled()) console.log("temporaryResetDatabase called; switching to " + defaultDatabaseKey);
  currentDatabaseThing = databases[defaultDatabaseKey].thing;
};

abstraction.open = function open (lDatabases, lDatabaseKey, callback) {
  databases = lDatabases;
  let databaseOpenFunctions = Object.keys(lDatabases).map((databaseKey) => {
    return function (callback) {
      databases[databaseKey].thing = new sqlite3.Database(
        path.resolve(__dirname, "db-" + databases[databaseKey].name + ".db"),
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        callback
      );
    };
  });
  async.series(
    databaseOpenFunctions,
    function (err) {
      if (err) return objectError(err, callback);
      defaultDatabaseKey = lDatabaseKey;
      abstraction.temporarySetDatabase(lDatabaseKey);
      return callback(false);
    }
  );
};

abstraction.close = function close (callback) {
  let databaseCloseFunctions = Object.keys(databases).map((databaseKey) => {
    return function (callback) {
      if (databases[databaseKey].thing !== null && databases[databaseKey].thing.close) return databases[databaseKey].thing.close(next);
      return next(false);
    };
  });
  async.waterfall(
    databaseCloseFunctions,
    function (err) {
      if (err) return objectError(err.toString() + " (abstraction.close: defaultDatabaseKey is dirty and temporarySetDatabase has not been called!)", callback);
      defaultDatabaseKey = null;
      abstraction.temporarySetDatabase(null);
      return callback(false);
    }
  );
};

abstraction.select = function select (table, map, callback) {
  let sql = "SELECT * FROM '" + table + "'" + whereWork(map) + ";";
  if (debug.getEnabled()) console.log(sql);
  return currentDatabaseThing.all(sql, function (err, rows) {
    if (err) return objectError("abstraction.select:" + err.toString(), callback);
    return callback(false, rows);
  });
};

abstraction.selectAdvanced = function selectAdvanced (database, table, map, limit, callback) {
  let limitBit = (limit !== undefined && limit !== null ? " LIMIT " + limit.toString() : "");
  let sql = "SELECT * FROM '" + table + "'" + whereWork(map) + limitBit + ";";
  if (debug.getEnabled()) console.log(sql);
  return databases[database].thing.all(sql, function (err, rows) {
    if (err) return objectError("abstraction.selectAdvanced:" + err.toString(), callback);
    return callback(false, rows);
  });
};

abstraction.insert = function insert (database, table, map, callback) {
  let sql = "INSERT INTO '" + table + "' (" + parameterWork(Object.keys(map)) + ") VALUES (" + parameterWork(ueber.getObjectValues(map), true) + ")" + ";";
  if (debug.getEnabled()) console.log(sql);
  let values = ueber.getObjectValues(map);
  return databases[database].thing.run(sql, values, function (err) {
    if (err) return objectError("abstraction.insert:" + err.toString(), callback);
    return getLastIdAssignableObject(database, table, function (err, assignableObject) {
      if (err) return callback(err);
      return callback(
        false,
        Object.assign({}, map, assignableObject)
      );
    });
  });
};

abstraction.update = function update (database, table, map, whereMap, callback) {
  if (Object.keys(map).length === 0) return callback(false);
  let sql = "UPDATE '" + table + "' SET " + updateWork(map, true) + whereWork(whereMap) + ";";
  if (debug.getEnabled()) console.log(sql);
  let values = ueber.getObjectValues(map);
  return databases[database].thing.all(sql, values, function (err, rows) {
    if (err) return objectError("abstraction.update:" + err.toString(), callback);
    callback(false);
  });
};

abstraction.delete = function (database, table, map, callback) {
  let sql = "DELETE FROM '" + table + "'" + whereWork(map) + ";";
  if (debug.getEnabled()) console.log(sql);
  return databases[database].thing.all(sql, function (err) {
    if (err) return objectError("abstraction.delete:" + err.toString(), callback);
    return callback(false);
  });
};