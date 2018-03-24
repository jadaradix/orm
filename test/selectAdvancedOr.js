'use strict';

const adapter = require('../index')

const DATABASES = {
  core: {
    name: 'core',
    thing: null
  }
}
const DATABASE_DEFAULT_NAME = DATABASES['core'].name

new Promise((resolve, reject) => {
  return adapter.open(DATABASES, DATABASE_DEFAULT_NAME, err => {
    if (!err) {
      return resolve()
    } else {
      return reject(err)
    }
  })
})
  .then(() => {
    adapter.selectAdvancedOr('core', 'Cats', {'name': ['Stinky', 'Smelly']}, 2, (err, results) => {
      if (err) {
        throw new Error('could not selectAdvancedOr', err)
      }
      console.log(`results: ${JSON.stringify(results)}`)
      return process.exit(0)
    })
  })
  .catch((err) => {
    console.error('could not open adapter connection', err)
    return process.exit(1)
  })
