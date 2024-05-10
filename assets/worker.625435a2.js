"use strict";
/*! For license information please see workerpool.min.js.LICENSE.txt */
// @ts-ignore
!function (e, r) { "object" == typeof exports && "undefined" != typeof module ? r(exports) : "function" == typeof define && define.amd ? define(["exports"], r) : r((e = "undefined" != typeof globalThis ? globalThis : e || self).workerpool = {}); }(this, (function (e) {
    "use strict";
    var r = {}, t = { exports: {} };
    !function (e) { var r = function (e) { return void 0 !== e && null != e.versions && null != e.versions.node && e + "" == "[object process]"; }; e.exports.isNode = r, e.exports.platform = "undefined" != typeof process && r(process) ? "node" : "browser"; var t = "node" === e.exports.platform && require("worker_threads"); e.exports.isMainThread = "node" === e.exports.platform ? (!t || t.isMainThread) && !process.connected : "undefined" != typeof Window, e.exports.cpus = "browser" === e.exports.platform ? self.navigator.hardwareConcurrency : require("os").cpus().length; }(t);
    var n, o = t.exports, i = {};
    function s() { if (n)
        return i; function e(n, i) { var s = this; if (!(this instanceof e))
        throw new SyntaxError("Constructor must be called with the new operator"); if ("function" != typeof n)
        throw new SyntaxError("Function parameter handler(resolve, reject) missing"); var a = [], u = []; this.resolved = !1, this.rejected = !1, this.pending = !0; var c = function (e, r) { a.push(e), u.push(r); }; this.then = function (t, n) { return new e((function (e, o) { var i = t ? r(t, e, o) : e, s = n ? r(n, e, o) : o; c(i, s); }), s); }; var f = function (e) { return s.resolved = !0, s.rejected = !1, s.pending = !1, a.forEach((function (r) { r(e); })), c = function (r, t) { r(e); }, f = d = function () { }, s; }, d = function (e) { return s.resolved = !1, s.rejected = !0, s.pending = !1, u.forEach((function (r) { r(e); })), c = function (r, t) { t(e); }, f = d = function () { }, s; }; this.cancel = function () { return i ? i.cancel() : d(new t), s; }, this.timeout = function (e) { if (i)
        i.timeout(e);
    else {
        var r = setTimeout((function () { d(new o("Promise timed out after " + e + " ms")); }), e);
        s.always((function () { clearTimeout(r); }));
    } return s; }, n((function (e) { f(e); }), (function (e) { d(e); })); } function r(e, r, t) { return function (n) { try {
        var o = e(n);
        o && "function" == typeof o.then && "function" == typeof o.catch ? o.then(r, t) : r(o);
    }
    catch (e) {
        t(e);
    } }; } function t(e) { this.message = e || "promise cancelled", this.stack = (new Error).stack; } function o(e) { this.message = e || "timeout exceeded", this.stack = (new Error).stack; } return n = 1, e.prototype.catch = function (e) { return this.then(null, e); }, e.prototype.always = function (e) { return this.then(e, e); }, e.all = function (r) { return new e((function (e, t) { var n = r.length, o = []; n ? r.forEach((function (r, i) { r.then((function (r) { o[i] = r, 0 == --n && e(o); }), (function (e) { n = 0, t(e); })); })) : e(o); })); }, e.defer = function () { var r = {}; return r.promise = new e((function (e, t) { r.resolve = e, r.reject = t; })), r; }, t.prototype = new Error, t.prototype.constructor = Error, t.prototype.name = "CancellationError", e.CancellationError = t, o.prototype = new Error, o.prototype.constructor = Error, o.prototype.name = "TimeoutError", e.TimeoutError = o, i.Promise = e, i; }
    var a, u, c, f, d, p, h, l, m = { exports: {} }, k = {};
    function w() { return a || (a = 1, k.validateOptions = function (e, r, t) { if (e) {
        var n = e ? Object.keys(e) : [], o = n.find((e => !r.includes(e)));
        if (o)
            throw new Error('Object "' + t + '" contains an unknown option "' + o + '"');
        var i = r.find((e => Object.prototype[e] && !n.includes(e)));
        if (i)
            throw new Error('Object "' + t + '" contains an inherited option "' + i + '" which is not defined in the object itself but in its prototype. Only plain objects are allowed. Please remove the option from the prototype or override it with a value "undefined".');
        return e;
    } }, k.workerOptsNames = ["credentials", "name", "type"], k.forkOptsNames = ["cwd", "detached", "env", "execPath", "execArgv", "gid", "serialization", "signal", "killSignal", "silent", "stdio", "uid", "windowsVerbatimArguments", "timeout"], k.workerThreadOptsNames = ["argv", "env", "eval", "execArgv", "stdin", "stdout", "stderr", "workerData", "trackUnmanagedFds", "transferList", "resourceLimits", "name"]), k; }
    function v() { if (f)
        return m.exports; f = 1; var { Promise: e } = s(), r = o; const { validateOptions: t, forkOptsNames: n, workerThreadOptsNames: i, workerOptsNames: a } = w(); var d = "__workerpool-terminate__"; function p() { var e = l(); if (!e)
        throw new Error("WorkerPool: workerType = 'thread' is not supported, Node >= 11.7.0 required"); return e; } function h() { if ("function" != typeof Worker && ("object" != typeof Worker || "function" != typeof Worker.prototype.constructor))
        throw new Error("WorkerPool: Web Workers not supported"); } function l() { try {
        return require("worker_threads");
    }
    catch (e) {
        if ("object" == typeof e && null !== e && "MODULE_NOT_FOUND" === e.code)
            return null;
        throw e;
    } } function k(e, r, n) { t(r, a, "workerOpts"); var o = new n(e, r); return o.isBrowserWorker = !0, o.on = function (e, r) { this.addEventListener(e, (function (e) { r(e.data); })); }, o.send = function (e, r) { this.postMessage(e, r); }, o; } function v(e, r, n) { t(n?.workerThreadOpts, i, "workerThreadOpts"); var o = new r.Worker(e, { stdout: n?.emitStdStreams ?? !1, stderr: n?.emitStdStreams ?? !1, ...n?.workerThreadOpts }); return o.isWorkerThread = !0, o.send = function (e, r) { this.postMessage(e, r); }, o.kill = function () { return this.terminate(), !0; }, o.disconnect = function () { this.terminate(); }, n?.emitStdStreams && (o.stdout.on("data", (e => o.emit("stdout", e))), o.stderr.on("data", (e => o.emit("stderr", e)))), o; } function y(e, r, o) { t(r.forkOpts, n, "forkOpts"); var i = o.fork(e, r.forkArgs, r.forkOpts), s = i.send; return i.send = function (e) { return s.call(i, e); }, r.emitStdStreams && (i.stdout.on("data", (e => i.emit("stdout", e))), i.stderr.on("data", (e => i.emit("stderr", e)))), i.isChildProcess = !0, i; } function g(e) { e = e || {}; var r = process.execArgv.join(" "), t = -1 !== r.indexOf("--inspect"), n = -1 !== r.indexOf("--debug-brk"), o = []; return t && (o.push("--inspect=" + e.debugPort), n && o.push("--debug-brk")), process.execArgv.forEach((function (e) { e.indexOf("--max-old-space-size") > -1 && o.push(e); })), Object.assign({}, e, { forkArgs: e.forkArgs, forkOpts: Object.assign({}, e.forkOpts, { execArgv: (e.forkOpts && e.forkOpts.execArgv || []).concat(o), stdio: e.emitStdStreams ? "pipe" : void 0 }) }); } function O(e, r) { if (1 === Object.keys(e.processing).length) {
        var t = Object.values(e.processing)[0];
        t.options && "function" == typeof t.options.on && t.options.on(r);
    } } function b(e, t) { var n = this, o = t || {}; function i(e) { for (var r in n.terminated = !0, n.processing)
        void 0 !== n.processing[r] && n.processing[r].resolver.reject(e); n.processing = Object.create(null); } this.script = e || function () { if ("browser" === r.platform) {
        if ("undefined" == typeof Blob)
            throw new Error("Blob not supported by the browser");
        if (!window.URL || "function" != typeof window.URL.createObjectURL)
            throw new Error("URL.createObjectURL not supported by the browser");
        var e = new Blob([c ? u : (c = 1, u = '!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):(e="undefined"!=typeof globalThis?globalThis:e||self).worker=n()}(this,(function(){"use strict";function e(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}var n={};var t=function(e,n){this.message=e,this.transfer=n};return function(e){var n=t,r={exit:function(){}};if("undefined"!=typeof self&&"function"==typeof postMessage&&"function"==typeof addEventListener)r.on=function(e,n){addEventListener(e,(function(e){n(e.data)}))},r.send=function(e){postMessage(e)};else{if("undefined"==typeof process)throw new Error("Script must be executed as a worker");var o;try{o=require("worker_threads")}catch(e){if("object"!=typeof e||null===e||"MODULE_NOT_FOUND"!==e.code)throw e}if(o&&null!==o.parentPort){var i=o.parentPort;r.send=i.postMessage.bind(i),r.on=i.on.bind(i),r.exit=process.exit.bind(process)}else r.on=process.on.bind(process),r.send=function(e){process.send(e)},r.on("disconnect",(function(){process.exit(1)})),r.exit=process.exit.bind(process)}function s(e){return Object.getOwnPropertyNames(e).reduce((function(n,t){return Object.defineProperty(n,t,{value:e[t],enumerable:!0})}),{})}function d(e){return e&&"function"==typeof e.then&&"function"==typeof e.catch}r.methods={},r.methods.run=function(e,n){var t=new Function("return ("+e+").apply(null, arguments);");return t.apply(t,n)},r.methods.methods=function(){return Object.keys(r.methods)},r.terminationHandler=void 0,r.cleanupAndExit=function(e){var n=function(){r.exit(e)};if(!r.terminationHandler)return n();var t=r.terminationHandler(e);d(t)?t.then(n,n):n()};var u=null;r.on("message",(function(e){if("__workerpool-terminate__"===e)return r.cleanupAndExit(0);try{var t=r.methods[e.method];if(!t)throw new Error(\'Unknown method "\'+e.method+\'"\');u=e.id;var o=t.apply(t,e.params);d(o)?o.then((function(t){t instanceof n?r.send({id:e.id,result:t.message,error:null},t.transfer):r.send({id:e.id,result:t,error:null}),u=null})).catch((function(n){r.send({id:e.id,result:null,error:s(n)}),u=null})):(o instanceof n?r.send({id:e.id,result:o.message,error:null},o.transfer):r.send({id:e.id,result:o,error:null}),u=null)}catch(n){r.send({id:e.id,result:null,error:s(n)})}})),r.register=function(e,n){if(e)for(var t in e)e.hasOwnProperty(t)&&(r.methods[t]=e[t]);n&&(r.terminationHandler=n.onTerminate),r.send("ready")},r.emit=function(e){if(u){if(e instanceof n)return void r.send({id:u,isEvent:!0,payload:e.message},e.transfer);r.send({id:u,isEvent:!0,payload:e})}},e.add=r.register,e.emit=r.emit}(n),e(n)}));\n//# sourceMappingURL=worker.min.js.map\n')], { type: "text/javascript" });
        return window.URL.createObjectURL(e);
    } return __dirname + "/worker.js"; }(), this.worker = function (e, t) { if ("web" === t.workerType)
        return h(), k(e, t.workerOpts, Worker); if ("thread" === t.workerType)
        return v(e, n = p(), t); if ("process" !== t.workerType && t.workerType) {
        if ("browser" === r.platform)
            return h(), k(e, t.workerOpts, Worker);
        var n = l();
        return n ? v(e, n, t) : y(e, g(t), require("child_process"));
    } return y(e, g(t), require("child_process")); }(this.script, o), this.debugPort = o.debugPort, this.forkOpts = o.forkOpts, this.forkArgs = o.forkArgs, this.workerOpts = o.workerOpts, this.workerThreadOpts = o.workerThreadOpts, this.workerTerminateTimeout = o.workerTerminateTimeout, e || (this.worker.ready = !0), this.requestQueue = [], this.worker.on("stdout", (function (e) { O(n, { stdout: e.toString() }); })), this.worker.on("stderr", (function (e) { O(n, { stderr: e.toString() }); })), this.worker.on("message", (function (e) { if (!n.terminated)
        if ("string" == typeof e && "ready" === e)
            n.worker.ready = !0, function () { for (const e of n.requestQueue.splice(0))
                n.worker.send(e.message, e.transfer); }();
        else {
            var r = e.id, t = n.processing[r];
            void 0 !== t && (e.isEvent ? t.options && "function" == typeof t.options.on && t.options.on(e.payload) : (delete n.processing[r], !0 === n.terminating && n.terminate(), e.error ? t.resolver.reject(function (e) { for (var r = new Error(""), t = Object.keys(e), n = 0; n < t.length; n++)
                r[t[n]] = e[t[n]]; return r; }(e.error)) : t.resolver.resolve(e.result)));
        } })); var s = this.worker; this.worker.on("error", i), this.worker.on("exit", (function (e, r) { var t = "Workerpool Worker terminated Unexpectedly\n"; t += "    exitCode: `" + e + "`\n", t += "    signalCode: `" + r + "`\n", t += "    workerpool.script: `" + n.script + "`\n", t += "    spawnArgs: `" + s.spawnargs + "`\n", t += "    spawnfile: `" + s.spawnfile + "`\n", t += "    stdout: `" + s.stdout + "`\n", t += "    stderr: `" + s.stderr + "`\n", i(new Error(t)); })), this.processing = Object.create(null), this.terminating = !1, this.terminated = !1, this.cleaning = !1, this.terminationHandler = null, this.lastId = 0; } return b.prototype.methods = function () { return this.exec("methods"); }, b.prototype.exec = function (r, t, n, o) { n || (n = e.defer()); var i = ++this.lastId; this.processing[i] = { id: i, resolver: n, options: o }; var s = { message: { id: i, method: r, params: t }, transfer: o && o.transfer }; this.terminated ? n.reject(new Error("Worker is terminated")) : this.worker.ready ? this.worker.send(s.message, s.transfer) : this.requestQueue.push(s); var a = this; return n.promise.catch((function (r) { if (r instanceof e.CancellationError || r instanceof e.TimeoutError)
        return delete a.processing[i], a.terminateAndNotify(!0).then((function () { throw r; }), (function (e) { throw e; })); throw r; })); }, b.prototype.busy = function () { return this.cleaning || Object.keys(this.processing).length > 0; }, b.prototype.terminate = function (e, r) { var t = this; if (e) {
        for (var n in this.processing)
            void 0 !== this.processing[n] && this.processing[n].resolver.reject(new Error("Worker terminated"));
        this.processing = Object.create(null);
    } if ("function" == typeof r && (this.terminationHandler = r), this.busy())
        this.terminating = !0;
    else {
        var o = function (e) { if (t.terminated = !0, t.cleaning = !1, null != t.worker && t.worker.removeAllListeners && t.worker.removeAllListeners("message"), t.worker = null, t.terminating = !1, t.terminationHandler)
            t.terminationHandler(e, t);
        else if (e)
            throw e; };
        if (this.worker) {
            if ("function" == typeof this.worker.kill) {
                if (this.worker.killed)
                    return void o(new Error("worker already killed!"));
                var i = setTimeout((function () { t.worker && t.worker.kill(); }), this.workerTerminateTimeout);
                return this.worker.once("exit", (function () { clearTimeout(i), t.worker && (t.worker.killed = !0), o(); })), this.worker.ready ? this.worker.send(d) : this.requestQueue.push({ message: d }), void (this.cleaning = !0);
            }
            if ("function" != typeof this.worker.terminate)
                throw new Error("Failed to terminate worker");
            this.worker.terminate(), this.worker.killed = !0;
        }
        o();
    } }, b.prototype.terminateAndNotify = function (r, t) { var n = e.defer(); return t && n.promise.timeout(t), this.terminate(r, (function (e, r) { e ? n.reject(e) : n.resolve(r); })), n.promise; }, m.exports = b, m.exports._tryRequireWorkerThreads = l, m.exports._setupProcessWorker = y, m.exports._setupBrowserWorker = k, m.exports._setupWorkerThreadWorker = v, m.exports.ensureWorkerThreads = p, m.exports; }
    function y() { if (l)
        return h; l = 1; var { Promise: e } = s(), r = v(), t = o, n = new (function () { if (p)
        return d; function e() { this.ports = Object.create(null), this.length = 0; } return p = 1, d = e, e.prototype.nextAvailableStartingAt = function (e) { for (; !0 === this.ports[e];)
        e++; if (e >= 65535)
        throw new Error("WorkerPool debug port limit reached: " + e + ">= 65535"); return this.ports[e] = !0, this.length++, e; }, e.prototype.releasePort = function (e) { delete this.ports[e], this.length--; }, d; }()); function i(e, n) { "string" == typeof e ? this.script = e || null : (this.script = null, n = e), this.workers = [], this.tasks = [], n = n || {}, this.forkArgs = Object.freeze(n.forkArgs || []), this.forkOpts = Object.freeze(n.forkOpts || {}), this.workerOpts = Object.freeze(n.workerOpts || {}), this.workerThreadOpts = Object.freeze(n.workerThreadOpts || {}), this.debugPortStart = n.debugPortStart || 43210, this.nodeWorker = n.nodeWorker, this.workerType = n.workerType || n.nodeWorker || "auto", this.maxQueueSize = n.maxQueueSize || 1 / 0, this.workerTerminateTimeout = n.workerTerminateTimeout || 1e3, this.onCreateWorker = n.onCreateWorker || (() => null), this.onTerminateWorker = n.onTerminateWorker || (() => null), this.emitStdStreams = n.emitStdStreams || !1, n && "maxWorkers" in n ? (!function (e) { if (!a(e) || !u(e) || e < 1)
        throw new TypeError("Option maxWorkers must be an integer number >= 1"); }(n.maxWorkers), this.maxWorkers = n.maxWorkers) : this.maxWorkers = Math.max((t.cpus || 4) - 1, 1), n && "minWorkers" in n && ("max" === n.minWorkers ? this.minWorkers = this.maxWorkers : (!function (e) { if (!a(e) || !u(e) || e < 0)
        throw new TypeError("Option minWorkers must be an integer number >= 0"); }(n.minWorkers), this.minWorkers = n.minWorkers, this.maxWorkers = Math.max(this.minWorkers, this.maxWorkers)), this._ensureMinWorkers()), this._boundNext = this._next.bind(this), "thread" === this.workerType && r.ensureWorkerThreads(); } function a(e) { return "number" == typeof e; } function u(e) { return Math.round(e) == e; } return i.prototype.exec = function (r, t, n) { if (t && !Array.isArray(t))
        throw new TypeError('Array expected as argument "params"'); if ("string" == typeof r) {
        var o = e.defer();
        if (this.tasks.length >= this.maxQueueSize)
            throw new Error("Max queue size of " + this.maxQueueSize + " reached");
        var i = this.tasks, s = { method: r, params: t, resolver: o, timeout: null, options: n };
        i.push(s);
        var a = o.promise.timeout;
        return o.promise.timeout = function (e) { return -1 !== i.indexOf(s) ? (s.timeout = e, o.promise) : a.call(o.promise, e); }, this._next(), o.promise;
    } if ("function" == typeof r)
        return this.exec("run", [String(r), t], n); throw new TypeError('Function or string expected as argument "method"'); }, i.prototype.proxy = function () { if (arguments.length > 0)
        throw new Error("No arguments expected"); var e = this; return this.exec("methods").then((function (r) { var t = {}; return r.forEach((function (r) { t[r] = function () { return e.exec(r, Array.prototype.slice.call(arguments)); }; })), t; })); }, i.prototype._next = function () { if (this.tasks.length > 0) {
        var e = this._getWorker();
        if (e) {
            var r = this, t = this.tasks.shift();
            if (t.resolver.promise.pending) {
                var n = e.exec(t.method, t.params, t.resolver, t.options).then(r._boundNext).catch((function () { if (e.terminated)
                    return r._removeWorker(e); })).then((function () { r._next(); }));
                "number" == typeof t.timeout && n.timeout(t.timeout);
            }
            else
                r._next();
        }
    } }, i.prototype._getWorker = function () { for (var e = this.workers, r = 0; r < e.length; r++) {
        var t = e[r];
        if (!1 === t.busy())
            return t;
    } return e.length < this.maxWorkers ? (t = this._createWorkerHandler(), e.push(t), t) : null; }, i.prototype._removeWorker = function (r) { var t = this; return n.releasePort(r.debugPort), this._removeWorkerFromList(r), this._ensureMinWorkers(), new e((function (e, n) { r.terminate(!1, (function (o) { t.onTerminateWorker({ forkArgs: r.forkArgs, forkOpts: r.forkOpts, workerThreadOpts: r.workerThreadOpts, script: r.script }), o ? n(o) : e(r); })); })); }, i.prototype._removeWorkerFromList = function (e) { var r = this.workers.indexOf(e); -1 !== r && this.workers.splice(r, 1); }, i.prototype.terminate = function (r, t) { var o = this; this.tasks.forEach((function (e) { e.resolver.reject(new Error("Pool terminated")); })), this.tasks.length = 0; var i = function (e) { n.releasePort(e.debugPort), this._removeWorkerFromList(e); }.bind(this), s = []; return this.workers.slice().forEach((function (e) { var n = e.terminateAndNotify(r, t).then(i).always((function () { o.onTerminateWorker({ forkArgs: e.forkArgs, forkOpts: e.forkOpts, workerThreadOpts: e.workerThreadOpts, script: e.script }); })); s.push(n); })), e.all(s); }, i.prototype.stats = function () { var e = this.workers.length, r = this.workers.filter((function (e) { return e.busy(); })).length; return { totalWorkers: e, busyWorkers: r, idleWorkers: e - r, pendingTasks: this.tasks.length, activeTasks: r }; }, i.prototype._ensureMinWorkers = function () { if (this.minWorkers)
        for (var e = this.workers.length; e < this.minWorkers; e++)
            this.workers.push(this._createWorkerHandler()); }, i.prototype._createWorkerHandler = function () { const e = this.onCreateWorker({ forkArgs: this.forkArgs, forkOpts: this.forkOpts, workerOpts: this.workerOpts, workerThreadOpts: this.workerThreadOpts, script: this.script }) || {}; return new r(e.script || this.script, { forkArgs: e.forkArgs || this.forkArgs, forkOpts: e.forkOpts || this.forkOpts, workerOpts: e.workerOpts || this.workerOpts, workerThreadOpts: e.workerThreadOpts || this.workerThreadOpts, debugPort: n.nextAvailableStartingAt(this.debugPortStart), workerType: this.workerType, workerTerminateTimeout: this.workerTerminateTimeout, emitStdStreams: this.emitStdStreams }); }, h = i; }
    var g, O, b, x = {};
    function T() { if (O)
        return g; return O = 1, g = function (e, r) { this.message = e, this.transfer = r; }; }
    function W() { return b || (b = 1, function (e) { var r = T(), t = { exit: function () { } }; if ("undefined" != typeof self && "function" == typeof postMessage && "function" == typeof addEventListener)
        t.on = function (e, r) { addEventListener(e, (function (e) { r(e.data); })); }, t.send = function (e) { postMessage(e); };
    else {
        if ("undefined" == typeof process)
            throw new Error("Script must be executed as a worker");
        var n;
        try {
            n = require("worker_threads");
        }
        catch (e) {
            if ("object" != typeof e || null === e || "MODULE_NOT_FOUND" !== e.code)
                throw e;
        }
        if (n && null !== n.parentPort) {
            var o = n.parentPort;
            t.send = o.postMessage.bind(o), t.on = o.on.bind(o), t.exit = process.exit.bind(process);
        }
        else
            t.on = process.on.bind(process), t.send = function (e) { process.send(e); }, t.on("disconnect", (function () { process.exit(1); })), t.exit = process.exit.bind(process);
    } function i(e) { return Object.getOwnPropertyNames(e).reduce((function (r, t) { return Object.defineProperty(r, t, { value: e[t], enumerable: !0 }); }), {}); } function s(e) { return e && "function" == typeof e.then && "function" == typeof e.catch; } t.methods = {}, t.methods.run = function (e, r) { var t = new Function("return (" + e + ").apply(null, arguments);"); return t.apply(t, r); }, t.methods.methods = function () { return Object.keys(t.methods); }, t.terminationHandler = void 0, t.cleanupAndExit = function (e) { var r = function () { t.exit(e); }; if (!t.terminationHandler)
        return r(); var n = t.terminationHandler(e); s(n) ? n.then(r, r) : r(); }; var a = null; t.on("message", (function (e) { if ("__workerpool-terminate__" === e)
        return t.cleanupAndExit(0); try {
        var n = t.methods[e.method];
        if (!n)
            throw new Error('Unknown method "' + e.method + '"');
        a = e.id;
        var o = n.apply(n, e.params);
        s(o) ? o.then((function (n) { n instanceof r ? t.send({ id: e.id, result: n.message, error: null }, n.transfer) : t.send({ id: e.id, result: n, error: null }), a = null; })).catch((function (r) { t.send({ id: e.id, result: null, error: i(r) }), a = null; })) : (o instanceof r ? t.send({ id: e.id, result: o.message, error: null }, o.transfer) : t.send({ id: e.id, result: o, error: null }), a = null);
    }
    catch (r) {
        t.send({ id: e.id, result: null, error: i(r) });
    } })), t.register = function (e, r) { if (e)
        for (var n in e)
            e.hasOwnProperty(n) && (t.methods[n] = e[n]); r && (t.terminationHandler = r.onTerminate), t.send("ready"); }, t.emit = function (e) { if (a) {
        if (e instanceof r)
            return void t.send({ id: a, isEvent: !0, payload: e.message }, e.transfer);
        t.send({ id: a, isEvent: !0, payload: e });
    } }, e.add = t.register, e.emit = t.emit; }(x)), x; }
    const { platform: E, isMainThread: _, cpus: j } = o;
    var A = r.pool = function (e, r) { return new (y())(e, r); };
    var P = r.worker = function (e, r) { W().add(e, r); };
    var S = r.workerEmit = function (e) { W().emit(e); };
    const { Promise: M } = s();
    var L = r.Promise = M, N = r.Transfer = T(), U = r.platform = E, H = r.isMainThread = _, q = r.cpus = j;
    e.Promise = L, e.Transfer = N, e.cpus = q, e.default = r, e.isMainThread = H, e.platform = U, e.pool = A, e.worker = P, e.workerEmit = S, Object.defineProperty(e, "__esModule", { value: !0 });
}));
//# sourceMappingURL=workerpool.min.js.map
// @ts-ignore
const pool = workerpool.worker({
    loadPng,
});
function gsidem2terrainrgb(r, g, b) {
    // https://qiita.com/frogcat/items/d12bed4e930b83eb3544
    let rgb = (r << 16) + (g << 8) + b;
    let h = 0;
    if (rgb < 0x800000)
        h = rgb * 0.01;
    else if (rgb > 0x800000)
        h = (rgb - Math.pow(2, 24)) * 0.01;
    rgb = Math.floor((h + 10000) / 0.1);
    const tR = (rgb & 0xff0000) >> 16;
    const tG = (rgb & 0x00ff00) >> 8;
    const tB = rgb & 0x0000ff;
    return [tR, tG, tB];
}
async function loadPng(url) {
    let res;
    try {
        res = await fetch(url);
    }
    catch (e) {
        return null;
    }
    if (!res.ok) {
        return null;
    }
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', {
        willReadFrequently: true,
    });
    // 地理院標高タイルを採用している一部のタイルは無効値が透過されていることがある
    // 透過されている場合に無効値にフォールバックさせる=rgb(128,0,0)で塗りつぶす
    context.fillStyle = 'rgb(128,0,0)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length / 4; i++) {
        const tRGB = gsidem2terrainrgb(imageData.data[i * 4], imageData.data[i * 4 + 1], imageData.data[i * 4 + 2]);
        imageData.data[i * 4] = tRGB[0];
        imageData.data[i * 4 + 1] = tRGB[1];
        imageData.data[i * 4 + 2] = tRGB[2];
    }
    const canvas2 = new OffscreenCanvas(imageData.width, imageData.height);
    const context2 = canvas2.getContext('2d', {
        willReadFrequently: true,
    });
    context2.putImageData(imageData, 0, 0);
    // blob to typedarray
    const b2 = await canvas2.convertToBlob();
    const ab = await b2.arrayBuffer();
    return new Uint8Array(ab);
}
