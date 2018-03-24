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
    adapter.insert('core', 'Cats', { 'name': 'Stuffy' }, (err, inserted) => {
      if (err) {
        throw new Error('could not insert')
      }
      console.log(`inserted: ${JSON.stringify(inserted)}`)
      adapter.howMany('core', 'Cats', {}, (err, howMany) => {
        if (err) {
          throw new Error('could not howMany')
        }
        console.log(`count: ${howMany}`)
        return process.exit(0)
      })
    })
  })
  .catch(() => {
    console.error('could not open adapter connection')
    return process.exit(1)
  })
