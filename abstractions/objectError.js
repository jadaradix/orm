const objectError = (err, callback) => {
  return callback({
    "statusCode": 500,
    "statusMessage": err.toString()
  })
}

module.exports = objectError
