'use strict';

// Prevent creating dependencies by randomizing tests.
jasmine.getEnv().randomizeTests(true);

// Restrict the prettyPrint depth so Jasmine doesn't freeze the
// page while attempting to print large objects.
// https://github.com/jasmine/jasmine/issues/1291
jasmine.MAX_PRETTY_PRINT_DEPTH = 5;
jasmine.MAX_PRETTY_PRINT_ARRAY_LENGTH = 10;

// Generate our own seed so we can print it in the console, for CI debugging.
var seed = jasmine.getEnv().seed() || String(Math.random()).slice(-5); // Same seed function as Jasmine.
jasmine.getEnv().seed(seed);
console.log('Jasmine seed used: ' + seed);

// Stub Date/setTimeout/setInterval. Has to happen outside of beforeEach, as
// libraries might hold onto references, see e.g.:
// - https://github.com/lodash/lodash/issues/304
// - https://github.com/lodash/lodash/issues/2054
jasmine.clock().mockDate();
jasmine.clock().install();

// Jasmine.clock doesn't support stubbing setImmediate:
// - https://github.com/jasmine/jasmine/issues/866
// Therefore we change it to call window.setTimeout, which we have stubbed
// above. Note that various async libraries rely on setImmediate, so you'll have
// to use `jasmine.clock().tick(1)` when using them.
window.setImmediate = function (fn) {
  return window.setTimeout(fn, 0);
};
window.clearImmediate = function (id) {
  return window.clearTimeout(id);
};

// Similarly for requestAnimationFrame/cancelAnimationFrame, but set some delay
// to prevent very long animations running all the way (it can be useful to have
// to actually step through animations).
window.requestAnimationFrame = function (fn) {
  return window.setTimeout(fn, 1);
};
window.cancelAnimationFrame = function (id) {
  return window.clearTimeout(id);
};

// Always use promise-polyfill (which uses setTimeout), so we don't get
// asynchronous behaviour from promises.
var PromiseThatUsesSetTimeoutInternally = require('promise-polyfill');
window.Promise = PromiseThatUsesSetTimeoutInternally;
// Make sure that we don't load in some other promise library.
afterEach(function () {
  if (window.Promise !== PromiseThatUsesSetTimeoutInternally) {
    fail('window.Promise has been changed after running remix-jasmine-setup. Make sure your polyfills do not overwrite window.Promise');
  }
});

// There is no asynchronous behaviour any more, because we use jasmine.clock(),
// so set the timeout interval really tight.
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10; // milliseconds

// Override CSS that disables scrolling globally.
document.addEventListener('DOMContentLoaded', function () {
  document.documentElement.style.overflow = 'visible';
  document.body.style.overflow = 'scroll';
});

// Set up jasmine.Ajax.
require('jasmine-ajax');
jasmine.Ajax.install();

// Set up error catching for thrown errors, console.error, and console.warn.
var caughtError = false;
var oldOnError = window.onerror;
window.onerror = function () {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  caughtError = true;
  if (oldOnError) oldOnError.apply(window, args);
};
// Set up a dummy console so we're sure libraries and such will output their
// errors and warnings.
window.console = window.console || {};
window.console.log = window.console.log || function () {};
window.console.info = window.console.info || function () {};
window.console.warn = window.console.warn || function () {};
window.console.error = window.console.error || function () {};

// Disallow using the console (to prevent calls from getting into production code).
var oldConsoleFunctions = {};
Object.keys(console).forEach(function (key) {
  if (typeof console[key] === 'function') {
    oldConsoleFunctions[key] = console[key];
    console[key] = function () {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      // Detect karma logging to console.error by looking at the stack trace.
      if (key === 'error' && new Error().stack.match(/KarmaReporter\.specDone/)) {
        return;
      }

      // Don't fail tests when React shamelessly self-promotes.
      if (args[0].match && args[0].match(/React DevTools/)) {
        return;
      }

      // Don't fail on messages from webpack-dev-server.
      if (args[0].startsWith && (args[0].startsWith('[HMR]') || args[0].startsWith('[WDS]'))) {
        return;
      }

      caughtError = true;
      oldConsoleFunctions[key].call(console, "Don't log to console during Jasmine test runs.");
      oldConsoleFunctions[key].apply(console, args);
    };
  }
});

// Prints tests to console if `?loadConsoleReporter=true` is set; useful for debugging.
if (window.location.search.match('loadConsoleReporter=true')) {
  var consoleReporter = {
    specStarted: function specStarted(result) {
      oldConsoleFunctions.log('Spec started: ' + result.fullName);
    },
    specDone: function specDone(result) {
      oldConsoleFunctions.log('Spec done: ' + result.fullName);
    }
  };
  jasmine.getEnv().addReporter(consoleReporter);
}

// Push a callback from any code to do additional assertions before/after each test.
window.beforeTestCallbacks = [];
window.afterTestCallbacks = [];

// It's important that this is the very first `beforeEach`, because it will be
// run at the very beginning.
var numberOfElementsInBody = void 0; // To make sure tests don't leave elements in <body>.
beforeEach(function () {
  numberOfElementsInBody = document.body.childElementCount;
  jasmine.Ajax.requests.reset();
  jasmine.Ajax.stubs.reset();

  window.beforeTestCallbacks.forEach(function (callback) {
    return callback();
  });

  if (caughtError) {
    caughtError = false;
    fail('Caught error before test was run.');
  }
});

// It's important that this is the very first `afterEach`, because it will be
// run at the very end.
afterEach(function () {
  jasmine.Ajax.requests.reset();
  jasmine.Ajax.stubs.reset();

  // Make sure that no more async action is happening after each test. Slightly
  // hacky, but we don't know a better way. O_o"
  // Note: this currently causes HMR to fail on Jasmine.
  jasmine.clock().tick(1000000);
  jasmine.clock().tick(1000000);
  jasmine.clock().tick(1000000);
  jasmine.clock().tick(1000000);
  jasmine.clock().tick(1000000);

  window.afterTestCallbacks.forEach(function (callback) {
    return callback();
  });

  if (caughtError) {
    caughtError = false;
    fail('Caught error during or after test. Open the console to see more details.');
  }
  if (jasmine.Ajax.requests.count() > 0) {
    fail('Requests were made after the test.');
  }
  if (jasmine.Ajax.stubs.count > 0) {
    fail('Stubs were set after the test.');
  }
  if (document.body.childElementCount !== numberOfElementsInBody) {
    fail('Expected <body> to contain only ' + numberOfElementsInBody + ' elements ' + ('but it contained ' + document.body.childElementCount + '. Forgot to clean up?'));
  }
});

