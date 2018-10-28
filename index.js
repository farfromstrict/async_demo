const chalk = require("chalk")
const Promise = require("bluebird")
const co = require("co")
const thunkify = require("thunkify")

const DURATION = 1000


function getTime() {
    let time = new Date()
    let min = time.getMinutes()
    let sec = time.getSeconds()
    let msec = time.getMilliseconds()

    // return min + ":" + sec + "." + msec
    return sec + "." + msec
}

function sleep(id, millisecond) {
    let _start = new Date()
    while (new Date() - _start <= millisecond) {}
}

function asleep(id, millisecond, callback) {
    setTimeout(callback, millisecond)
}

function random() {
    return Math.floor(Math.random()*100) + 1
}

const normal_task = (id, val=0) => {
    console.log(getTime(), chalk.green.bold("[normal]"), chalk.green.bold("[" + id + "]"), "input:", val)
    let output = random()
    console.log(getTime(), chalk.green.bold("[normal]"), chalk.green.bold("[" + id + "]"), "output:", output)
    return output
} 

const sync_task = (id, req=0, duration=DURATION) => {
    console.log(getTime(), chalk.blue.bold("[sync]"), chalk.blue.bold("[" + id + "]"), "request:", req)
    sleep(id, duration)
    let resp = random()
    console.log(getTime(), chalk.blue.bold("[sync]"), chalk.blue.bold("[" + id + "]"), "response:", resp)
    return resp
}

const async_task = (id, req=0, callback, duration=DURATION) => {
    console.log(getTime(), chalk.red.bold("[async]"), chalk.red.bold("[" + id + "]"), "request:", req)
    asleep(id, duration, () => {
        let resp = random()
        console.log(getTime(), chalk.red.bold("[async]"), chalk.red.bold("[" + id + "]"), "response:", resp)
        callback && callback(null, resp)
    })
}

const async_promise = (id, req=0, duration=DURATION) => {
    return new Promise((resolve, reject) => {
        console.log(getTime(), chalk.red.bold("[async-p]"), chalk.red.bold("[" + id + "]"), "request:", req)
        asleep(id, duration, () => {
            let resp = random()
            console.log(getTime(), chalk.red.bold("[async-p]"), chalk.red.bold("[" + id + "]"), "response:", resp)
            return resolve(resp)
        })
    })
}


const sync_demo = () => {
    console.log(chalk.grey("sync"))

    let data = normal_task(1)
    data = sync_task(1, data)
    data = sync_task(2, data)
    data = sync_task(3, data)
    data = normal_task(2, data)
}


const serial_demo = () => {
    console.log(chalk.grey("serial"))

    let data = normal_task(1)

    async_task(1, data, (err, val) => {
        async_task(2, val, (err, val) => {
            async_task(3, val, (err, val) => {
                data = normal_task(2, val)
            })
        })
    })

    data = normal_task(3, data)
}


const parallel_demo = () => {
    console.log(chalk.grey("parallel"))

    let data = normal_task(1)

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
        async_task(id, val, (err, val) => {
            end[id-2] = true
            vals[id-2] = val
            check(vals => {
                data = normal_task(2, vals)
            })
        })
    }

    run(2, data)
    run(3, data)
    run(4, data)

    data = normal_task(3, data)
}


const promise_serial_demo = () => {
    console.log(chalk.grey("promise serial"))

    let data = normal_task(1)

    async_promise(2, data).then(val => {
        return async_promise(3, val)
    }).then(val => {
        return async_promise(4, val)
    }).then(val => {
        data = normal_task(2, val)
    })

    data = normal_task(3, data)
}


const promise_parallel_demo = () => {
    console.log(chalk.grey("promise parallel"))
    
    let data = normal_task(1)

    const promises = [
        async_promise(2, data), 
        async_promise(3, data), 
        async_promise(4, data)
    ]

    data = normal_task(2, data)

    Promise.all(promises).then(vals => {
        return vals
    }).then(vals => {
        data = normal_task(3, vals)
    })

    data = normal_task(4, data)
}


const generator_sync_demo = () => {
    console.log(chalk.grey("generator sync"))

    let data = normal_task(1)

    function* gen_sync_tasks() {
        val = yield sync_task(2, data)
        val = yield sync_task(3, val)
        val = yield sync_task(4, val)
        val = yield normal_task(2, val)
    }

    const run = (g, val) => {
        let result = g.next(val)
        if ( !result.done ) {
            run(g, result.value)
        }
    }

    run(gen_sync_tasks(), data)
}

const generator_serial_demo_p = () => {
    console.log(chalk.grey("generator serial - promise"))

    let data = normal_task(1)

    function* gen_async_tasks(val) {
        val = yield async_promise(2, val)
        val = yield async_promise(3, val)
        val = yield async_promise(4, val)
    }

    let g = gen_async_tasks(data)

    g.next().value.then(val => {
        g.next(val).value.then(val => {
            g.next(val).value.then(val => {
                data = normal_task(2, val)
            })
        })
    })

    data = normal_task(3, data)
}

const generator_serial_demo_t = () => {
    console.log(chalk.grey("generator serial - thunk"))

    let data = normal_task(1)

        const async_task_thunk = (id, req) => {
            return function (callback) {
                return async_task(id, req, callback)
            }
        }

        const normal_task_thunk = (id, req) => {
            return function () {
                normal_task(id, req)
            }
        }

    function* gen_async_tasks(val) {
            val = yield async_task_thunk(2, val)
            val = yield async_task_thunk(3, val)
            val = yield async_task_thunk(4, val)
            val = yield normal_task_thunk(2, val)
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

    run(gen_async_tasks, data)

    data = normal_task(3, data)
}


const async_serial_demo = () => {
    console.log(chalk.grey("async serial"))

    let data = normal_task(1)

    const async_tasks = async function (val) {
        val = await async_promise(2, val)
        val = await async_promise(3, val)
        val = await async_promise(4, val)
        return val
    }

    async_tasks(data).then(val => {
        normal_task(2, val)
    })

    data = normal_task(4, data)
}


const async_parallel_demo = () => {
    console.log(chalk.grey("async parallel"))

    let data = normal_task(1)

    const async_tasks = async function (val) {
        let vals = await Promise.all([
            async_promise(2, val),
            async_promise(3, val),
            async_promise(4, val)
        ])
        return vals
    }

    async_tasks(data).then(vals => {
        normal_task(2, vals)
    })

    data = normal_task(3, data)
}


const co_serial_demo_p = () => {
    console.log(chalk.grey("co serial - promise"))

    let data = normal_task(1)

    co((function* (val) {
        val = yield async_promise(2, val)
        val = yield async_promise(3, val)
        val = yield async_promise(4, val)
        val = yield Promise.promisify(sync_task)(2, val)
    })(data)).catch(err => {
        console.log(chalk.red(err))
    })

    data = normal_task(3, data)
}

const co_serial_demo_t = () => {
    console.log(chalk.grey("co serial - thunk"))

    let data = normal_task(1)

    co((function* (val) {
        val = yield thunkify(async_task)(2, val)
        val = yield thunkify(async_task)(3, val)
        val = yield thunkify(async_task)(4, val)
        val = yield thunkify(normal_task)(2, val)
    })(data)).catch(err => {
        console.log(chalk.red(err))
    })

    data = normal_task(3, data)
}


const co_parallel_demo = () => {
    console.log(chalk.grey("co parallel"))

    let data = normal_task(1)

    co((function* (val) {
        let result = yield [
            async_promise(2, val),
            async_promise(3, val),
            async_promise(4, val),
        ]
        return result
    })(data)).then(vals => {
        data = normal_task(5, vals)
    })

    data = normal_task(6, data)
}


// sync_demo()
// serial_demo()
// parallel_demo()
// promise_serial_demo()
// promise_parallel_demo()
// generator_sync_demo()
// generator_serial_demo_p()
// generator_serial_demo_t()
// async_serial_demo()
// async_parallel_demo()
// co_serial_demo_p()
// co_serial_demo_t()
// co_parallel_demo()
