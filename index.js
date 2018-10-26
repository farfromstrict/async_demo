const chalk = require("chalk");
const Promise = require("bluebird");
const co = require("co");
const thunkify = require("thunkify");

const DURATION = 1000;


function getTime() {
	let time = new Date();
	let min = time.getMinutes();
	let sec = time.getSeconds();
	let msec = time.getMilliseconds();

	// return min + ":" + sec + "." + msec;
	return sec + "." + msec;
}

function sleep(id, millisecond) {
	let _start = new Date();
	while (new Date() - _start <= millisecond) {}
}

function asleep(id, millisecond, callback) {
	setTimeout(callback, millisecond);
}

function random() {
	return Math.floor(Math.random()*100) + 1;
}

const normal_task = (id, val=0) => {
	console.log(getTime(), chalk.green.bold("[normal]"), chalk.green.bold("[" + id + "]"), "input:", val);
	let output = random();
	console.log(getTime(), chalk.green.bold("[normal]"), chalk.green.bold("[" + id + "]"), "output:", output);
	return output;
} 

const sync_task = (id, req=0, duration=DURATION) => {
	console.log(getTime(), chalk.blue.bold("[sync]"), chalk.blue.bold("[" + id + "]"), "request:", req);
	sleep(id, duration);
	let resp = random();
	console.log(getTime(), chalk.blue.bold("[sync]"), chalk.blue.bold("[" + id + "]"), "response:", resp);
	return resp;
}

const async_task = (id, req=0, callback, duration=DURATION) => {
	console.log(getTime(), chalk.red.bold("[async]"), chalk.red.bold("[" + id + "]"), "request:", req);
	asleep(id, duration, () => {
		let resp = random();
		console.log(getTime(), chalk.red.bold("[async]"), chalk.red.bold("[" + id + "]"), "response:", resp);
		callback && callback(resp);
	});
}

const async_promise = (id, req=0, duration=DURATION) => {
	return new Promise((resolve, reject) => {
		console.log(getTime(), chalk.red.bold("[async-p]"), chalk.red.bold("[" + id + "]"), "request:", req);
		asleep(id, duration, () => {
			let resp = random();
			console.log(getTime(), chalk.red.bold("[async-p]"), chalk.red.bold("[" + id + "]"), "response:", resp);
			return resolve(resp);
		});
	});
}


const sync_demo = () => {
	console.log(chalk.grey("sync"));

	var data = normal_task(1, data);
	data = sync_task(1, data);
	data = sync_task(2, data);
	data = sync_task(3, data);
	data = normal_task(2, data);	
}


const serial_demo = () => {
	console.log(chalk.grey("serial"));

	var data = normal_task(1, data);

	async_task(1, data, val => {
		async_task(2, val, val => {
			async_task(3, val, val => {
				data = normal_task(2, val);
			});
		});
	});

	data = normal_task(3, data);
}


const parallel_demo = () => {
	console.log(chalk.grey("parallel"));

	var data = normal_task(1);

	var end = [false, false, false];
	var vals = [-1, -1, -1];

	const check = callback => {
		for ( let val of end ) {
			if ( val === false ) {
				return;
			}
		}
		callback(vals);
	}

	const run = (id, val) => {
		async_task(id, val, val => {
			end[id-2] = true;
			vals[id-2] = val;
			check(vals => {
				data = normal_task(2, vals)
			});
		});
	}

	run(2, data);
	run(3, data);
	run(4, data);

	data = normal_task(3, data);
}


const promise_serail_demo = () => {
	console.log(chalk.grey("promise serial"));

	var data = normal_task(1);

	async_promise(2, data).then(val => {
		return async_promise(3, val);
	}).then(val => {
		return async_promise(4, val);
	}).then(val => {
		data = normal_task(2, val);
	});

	data = normal_task(3, data);
}


const promise_parallel_demo = () => {
	console.log(chalk.grey("promise parallel"));
	
	var data = normal_task(1);

	const promises = [
		async_promise(2, data), 
		async_promise(3, data), 
		async_promise(4, data)
	];

	data = normal_task(2, data);

	Promise.all(promises).then(vals => {
		return vals;
	}).then(vals => {
		data = normal_task(3, vals);
	})

	data = normal_task(4, data);
}


const generator_sync_demo = () => {
	console.log(chalk.grey("generator sync"));

	var data = normal_task(1);

	function* gen_sync_tasks() {
		val = yield sync_task(2, data);
		val = yield sync_task(3, val);
		val = yield sync_task(4, val);
		val = yield normal_task(2, val);
	}

	const run = (g, val) => {
		var result = g.next(val);
		if ( !result.done ) {
			run(g, result.value);
		}
	}

	run(gen_sync_tasks(), data);
}

const generator_serail_demo_p = () => {
	console.log(chalk.grey("generator serial - promise"));

	var data = normal_task(1);

	function* gen_async_tasks(val) {
		val = yield async_promise(2, val);
		val = yield async_promise(3, val);
		val = yield async_promise(4, val);
	}

	var g = gen_async_tasks(data);

	g.next().value.then(val => {
		g.next(val).value.then(val => {
			g.next(val).value.then(val => {
				data = normal_task(2, val);
			});
		});
	});

	data = normal_task(3, data);
}

const generator_serail_demo_t = () => {
	console.log(chalk.grey("generator serial - thunk"));

	var data = normal_task(1);

	function* gen_async_tasks(val) {
		val = yield thunkify(async_task)(2, val);
		val = yield thunkify(async_task)(3, val);
		val = yield thunkify(async_task)(4, val);
		val = yield thunkify(normal_task)(2, val);
	}

	const run = (fn, val) => {
		var g = fn(val);

		function next(val) {
			var result = g.next(val);
			if ( result.done ) return;
			result.value(val => next(val));
		}

		next(val);
	}

	run(gen_async_tasks, data);

	data = normal_task(3, data);
}


// const async_serail_demo = () => {}
// const async_parallel_demo = () => {}


const co_serail_demo_p = () => {
	console.log(chalk.grey("co serial - promise"));

	var data = normal_task(1);

	co((function* (val) {
		val = yield async_promise(2, val);
		val = yield async_promise(3, val);
		val = yield async_promise(4, val);
		val = yield Promise.promisify(sync_task)(2, val);
	})(data)).catch(err => {
		console.log(chalk.red(err));
	});

	data = normal_task(3, data);
}

const co_serail_demo_t = () => {
	console.log(chalk.grey("co serial - thunk"));
}


const co_parallel_demo = () => {
	console.log(chalk.grey("co parallel"));

	var data = normal_task(1);

	co((function* (val) {
		var result = yield [
			async_promise(2, val),
			async_promise(3, val),
			async_promise(4, val),
		];
		return result;
	})(data)).then(vals => {
		data = normal_task(5, vals);
	});

	data = normal_task(6, data);
}


// sync_demo();
// serial_demo();
// parallel_demo();
// promise_serail_demo();
// promise_parallel_demo();
// generator_sync_demo();
// generator_serail_demo_p();
// generator_serail_demo_t();
// co_serail_demo_p();
co_serail_demo_t();
// co_parallel_demo();
