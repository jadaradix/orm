'use strict';

const adapter = require('./index')

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
    adapter.insert('core', 'Dogs', { 'name': 'Woofer' }, (err, dog) => {
      if (err) {
        throw new Error('could not insert dog')
      }
      console.log(`inserted: ${JSON.stringify(dog)}`)
      adapter.howMany('core', 'Dogs', {}, (err, howMany) => {
        if (err) {
          throw new Error('could not count dogs')
        }
        console.log(`dogs: ${howMany}`)
        return process.exit(0)
      })
    })
  })
  .catch(() => {
    console.error('could not open adapter connection')
    return process.exit(1)
  })
