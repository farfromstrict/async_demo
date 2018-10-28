const chalk = require('chalk')
const Promise = require('bluebird')
const co = require('co')
const thunkify = require('thunkify')

const DURATION = 1000


function getTime() {
  const time = new Date()
  //const min = time.getMinutes()
  const sec = time.getSeconds()
  const msec = time.getMilliseconds()

  // return `${min}:${sec}.${msec}`
  return `${sec}.${msec}`
}

const sleep = (id, millisecond) => {
  const start = new Date()
  while (new Date() - start <= millisecond) {
    // empty loop
  }
}

const asleep = (id, millisecond, callback) => {
  setTimeout(callback, millisecond)
}

const random = () => Math.floor(Math.random() * 100) + 1

const normalTask = (id, val=0) => {
  console.log(getTime(), chalk.green.bold('[normal]'), chalk.green.bold('[' + id + ']'), 'input:', val)
  let output = random()
  console.log(getTime(), chalk.green.bold('[normal]'), chalk.green.bold('[' + id + ']'), 'output:', output)
  return output
} 

const syncTask = (id, req=0, duration=DURATION) => {
  console.log(getTime(), chalk.blue.bold('[sync]'), chalk.blue.bold('[' + id + ']'), 'request:', req)
  sleep(id, duration)
  let resp = random()
  console.log(getTime(), chalk.blue.bold('[sync]'), chalk.blue.bold('[' + id + ']'), 'response:', resp)
  return resp
}

const asyncTask = (id, req=0, callback, duration=DURATION) => {
  console.log(getTime(), chalk.red.bold('[async]'), chalk.red.bold('[' + id + ']'), 'request:', req)
  asleep(id, duration, () => {
    let resp = random()
    console.log(getTime(), chalk.red.bold('[async]'), chalk.red.bold('[' + id + ']'), 'response:', resp)
    callback && callback(null, resp)
  })
}

const asyncPromise = (id, req=0, duration=DURATION) => {
  return new Promise((resolve, reject) => {
    console.log(getTime(), chalk.red.bold('[async-p]'), chalk.red.bold('[' + id + ']'), 'request:', req)
    asleep(id, duration, () => {
      let resp = random()
      console.log(getTime(), chalk.red.bold('[async-p]'), chalk.red.bold('[' + id + ']'), 'response:', resp)
      return resolve(resp)
    })
  })
}


const syncDemo = () => {
  console.log(chalk.grey('sync'))

  let data = normalTask(1)
  data = syncTask(1, data)
  data = syncTask(2, data)
  data = syncTask(3, data)
  data = normalTask(2, data)
}


const serialDemo = () => {
  console.log(chalk.grey('serial'))

  let data = normalTask(1)

  asyncTask(1, data, (err, val) => {
    asyncTask(2, val, (err, val) => {
      asyncTask(3, val, (err, val) => {
        data = normalTask(2, val)
      })
    })
  })

  data = normalTask(3, data)
}


const parallelDemo = () => {
  console.log(chalk.grey('parallel'))

  let data = normalTask(1)

  let end = [false, false, false]
  let vals = [-1, -1, -1]

  const check = callback => {
    for ( let val of end ) {
      if ( val === false ) {
        return
      }
    }
    callback(vals)
  }

  const run = (id, val) => {
    asyncTask(id, val, (err, val) => {
      end[id-2] = true
      vals[id-2] = val
      check(vals => {
        data = normalTask(2, vals)
      })
    })
  }

  run(2, data)
  run(3, data)
  run(4, data)

  data = normalTask(3, data)
}


const promiseSerialDemo = () => {
  console.log(chalk.grey('promise serial'))

  let data = normalTask(1)

  asyncPromise(2, data).then(val => {
    return asyncPromise(3, val)
  }).then(val => {
    return asyncPromise(4, val)
  }).then(val => {
    data = normalTask(2, val)
  })

  data = normalTask(3, data)
}


const promiseParallelDemo = () => {
  console.log(chalk.grey('promise parallel'))
  
  let data = normalTask(1)

  const promises = [
    asyncPromise(2, data), 
    asyncPromise(3, data), 
    asyncPromise(4, data)
  ]

  data = normalTask(2, data)

  Promise.all(promises).then(vals => {
    return vals
  }).then(vals => {
    data = normalTask(3, vals)
  })

  data = normalTask(4, data)
}


const generatorSyncDemo = () => {
  console.log(chalk.grey('generator sync'))

  let data = normalTask(1)

  function* genSyncTasks() {
    val = yield syncTask(2, data)
    val = yield syncTask(3, val)
    val = yield syncTask(4, val)
    val = yield normalTask(2, val)
  }

  const run = (g, val) => {
    let result = g.next(val)
    if ( !result.done ) {
      run(g, result.value)
    }
  }

  run(genSyncTasks(), data)
}

const generatorSerialDemoP = () => {
  console.log(chalk.grey('generator serial - promise'))

  let data = normalTask(1)

  function* gen_asyncTasks(val) {
    val = yield asyncPromise(2, val)
    val = yield asyncPromise(3, val)
    val = yield asyncPromise(4, val)
  }

  let g = gen_asyncTasks(data)

  g.next().value.then(val => {
    g.next(val).value.then(val => {
      g.next(val).value.then(val => {
        data = normalTask(2, val)
      })
    })
  })

  data = normalTask(3, data)
}

const generatorSerialDemoT = () => {
  console.log(chalk.grey('generator serial - thunk'))

  let data = normalTask(1)

    const asyncTaskThunk = (id, req) => {
      return function (callback) {
        return asyncTask(id, req, callback)
      }
    }

    const normalTaskThunk = (id, req) => {
      return function () {
        normalTask(id, req)
      }
    }

  function* gen_asyncTasks(val) {
      val = yield asyncTaskThunk(2, val)
      val = yield asyncTaskThunk(3, val)
      val = yield asyncTaskThunk(4, val)
      val = yield normalTaskThunk(2, val)
  }

  const run = (fn, val) => {
    let g = fn(val)

    function next(err, val) {
      let result = g.next(val)
      if ( result.done ) return
      result.value((err, val) => next(err, val))
    }

    next(null, val)
  }

  run(gen_asyncTasks, data)

  data = normalTask(3, data)
}


const asyncSerialDemo = () => {
  console.log(chalk.grey('async serial'))

  let data = normalTask(1)

  const asyncTasks = async function (val) {
    val = await asyncPromise(2, val)
    val = await asyncPromise(3, val)
    val = await asyncPromise(4, val)
    return val
  }

  asyncTasks(data).then(val => {
    normalTask(2, val)
  })

  data = normalTask(4, data)
}


const asyncParallelDemo = () => {
  console.log(chalk.grey('async parallel'))

  let data = normalTask(1)

  const asyncTasks = async function (val) {
    let vals = await Promise.all([
      asyncPromise(2, val),
      asyncPromise(3, val),
      asyncPromise(4, val)
    ])
    return vals
  }

  asyncTasks(data).then(vals => {
    normalTask(2, vals)
  })

  data = normalTask(3, data)
}


const coSerialDemoP = () => {
  console.log(chalk.grey('co serial - promise'))

  let data = normalTask(1)

  co((function* (val) {
    val = yield asyncPromise(2, val)
    val = yield asyncPromise(3, val)
    val = yield asyncPromise(4, val)
    val = yield Promise.promisify(syncTask)(2, val)
  })(data)).catch(err => {
    console.log(chalk.red(err))
  })

  data = normalTask(3, data)
}

const coSerialDemoT = () => {
  console.log(chalk.grey('co serial - thunk'))

  let data = normalTask(1)

  co((function* (val) {
    val = yield thunkify(asyncTask)(2, val)
    val = yield thunkify(asyncTask)(3, val)
    val = yield thunkify(asyncTask)(4, val)
    val = yield thunkify(normalTask)(2, val)
  })(data)).catch(err => {
    console.log(chalk.red(err))
  })

  data = normalTask(3, data)
}


const coParallelDemo = () => {
  console.log(chalk.grey('co parallel'))

  let data = normalTask(1)

  co((function* (val) {
    const result = yield [
      asyncPromise(2, val),
      asyncPromise(3, val),
      asyncPromise(4, val),
    ]
    return result
  })(data)).then(vals => {
    data = normalTask(5, vals)
  })

  data = normalTask(6, data)
}


 syncDemo()
// serialDemo()
// parallelDemo()
// promiseSerialDemo()
// promiseParallelDemo()
// generatorSyncDemo()
// generatorSerialDemoP()
// generatorSerialDemoT()
// asyncSerialDemo()
// asyncParallelDemo()
// coSerialDemoP()
// coSerialDemoT()
// coParallelDemo()
