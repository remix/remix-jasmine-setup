if (!window.jasmine) {
  throw new Error(
    'Be sure Jasmine is loaded first. (https://github.com/jasmine/jasmine)'
  );
}
if (!jasmine.Ajax) {
  throw new Error(
    'Be sure jasmine-ajax is loaded first. (https://github.com/jasmine/jasmine-ajax)'
  );
}

// Prevent creating dependencies by randomizing tests.
jasmine.getEnv().randomizeTests(true);

// Restrict the prettyPrint depth so Jasmine doesn't freeze the
// page while attempting to print large objects.
// https://github.com/jasmine/jasmine/issues/1291
jasmine.MAX_PRETTY_PRINT_DEPTH = 5;
jasmine.MAX_PRETTY_PRINT_ARRAY_LENGTH = 10;

// Generate our own seed so we can print it in the console, for CI debugging.
const seed = jasmine.getEnv().seed() || String(Math.random()).slice(-5); // Same seed function as Jasmine.
jasmine.getEnv().seed(seed);
console.log(`Jasmine seed used: ${seed}`);

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
window.setImmediate = fn => window.setTimeout(fn, 0);
window.clearImmediate = id => window.clearTimeout(id);

// Similarly for requestAnimationFrame/cancelAnimationFrame, but set some delay
// to prevent very long animations running all the way (it can be useful to have
// to actually step through animations).
window.requestAnimationFrame = fn => window.setTimeout(fn, 1);
window.cancelAnimationFrame = id => window.clearTimeout(id);

// There is no asynchronous behaviour any more, because we use jasmine.clock(),
// so set the timeout interval really tight.
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10; // milliseconds

// Override CSS that disables scrolling globally.
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.overflow = 'visible';
  document.body.style.overflow = 'scroll';
});

// Set up jasmine.Ajax.
jasmine.Ajax.install();

// Set up error catching for thrown errors, console.error, and console.warn.
let caughtError = false;
const oldOnError = window.onerror;
window.onerror = (...args) => {
  caughtError = true;
  if (oldOnError) oldOnError.apply(window, args);
};
// Set up a dummy console so we're sure libraries and such will output their
// errors and warnings.
window.console = window.console || {};
window.console.log = window.console.log || (() => {});
window.console.info = window.console.info || (() => {});
window.console.warn = window.console.warn || (() => {});
window.console.error = window.console.error || (() => {});

// Disallow using the console (to prevent calls from getting into production code).
const oldConsoleFunctions = {};
Object.keys(console).forEach(key => {
  if (typeof console[key] === 'function') {
    oldConsoleFunctions[key] = console[key];
    console[key] = (...args) => {
      // Detect karma reporter logging to console by looking at the stack trace.
      const error = new Error();
      if (error.stack && error.stack.match(/KarmaReporter\.specDone/)) {
        return;
      }

      // Don't fail tests when React shamelessly self-promotes.
      if (args[0].match && args[0].match(/React DevTools/)) {
        return;
      }

      // Don't fail on messages from webpack-dev-server.
      if (
        args[0].startsWith &&
        (args[0].startsWith('[HMR]') || args[0].startsWith('[WDS]'))
      ) {
        return;
      }

      caughtError = true;
      oldConsoleFunctions[key].call(
        console,
        "Don't log to console during Jasmine test runs."
      );
      oldConsoleFunctions[key].apply(console, args);
    };
  }
});

// Prints tests to console if `?loadConsoleReporter=true` is set; useful for debugging.
if (window.location.search.match('loadConsoleReporter=true')) {
  const consoleReporter = {
    specStarted(result) {
      oldConsoleFunctions.log(`Spec started: ${result.fullName}`);
    },
    specDone(result) {
      oldConsoleFunctions.log(`Spec done: ${result.fullName}`);
    },
  };
  jasmine.getEnv().addReporter(consoleReporter);
}

// Push a callback from any code to do additional assertions before/after each test.
window.beforeTestCallbacks = [];
window.afterTestCallbacks = [];

// It's important that this is the very first `beforeEach`, because it will be
// run at the very beginning.
let numberOfElementsInBody; // To make sure tests don't leave elements in <body>.
beforeEach(() => {
  numberOfElementsInBody = document.body.childElementCount;
  jasmine.Ajax.requests.reset();
  jasmine.Ajax.stubs.reset();

  window.beforeTestCallbacks.forEach(callback => callback());

  if (caughtError) {
    caughtError = false;
    fail('Caught error before test was run.');
  }
});

// It's important that this is the very first `afterEach`, because it will be
// run at the very end.
afterEach(() => {
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

  window.afterTestCallbacks.forEach(callback => callback());

  if (caughtError) {
    caughtError = false;
    fail(
      'Caught error during or after test. Open the console to see more details.'
    );
  }
  if (jasmine.Ajax.requests.count() > 0) {
    fail('Requests were made after the test.');
  }
  if (jasmine.Ajax.stubs.count > 0) {
    fail('Stubs were set after the test.');
  }
  if (document.body.childElementCount !== numberOfElementsInBody) {
    fail(
      `Expected <body> to contain only ${numberOfElementsInBody} elements ` +
        `but it contained ${document.body
          .childElementCount}. Forgot to clean up?`
    );
  }

  // Make sure a good Promise polyfill/library is used.
  let promiseResolved = false;
  new window.Promise(resolve => {
    resolve();
  }).then(() => (promiseResolved = true));
  jasmine.clock().tick(1);
  if (!promiseResolved) {
    fail(
      'window.Promise does not get resolved when calling `jasmine.clock.tick(1)`, be sure to use a Promise polyfill that uses setTimeout like https://github.com/taylorhakes/promise-polyfill, and load it after loading remix-jasmine-setup.'
    );
  }
});
