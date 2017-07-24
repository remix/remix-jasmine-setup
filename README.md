# Remix's Jasmine setup
[![NPM version](https://badge.fury.io/js/remix-jasmine-setup.svg)](http://badge.fury.io/js/remix-jasmine-setup)
[![peerDependencies Status](https://david-dm.org/remix/remix-jasmine-setup/peer-status.svg)](https://david-dm.org/remix/remix-jasmine-setup?type=peer)
[![devDependencies Status](https://david-dm.org/remix/remix-jasmine-setup/dev-status.svg)](https://david-dm.org/remix/remix-jasmine-setup?type=dev)
[![Open Source Love](https://badges.frapsoft.com/os/mit/mit.svg?v=102)](https://github.com/ellerbrock/open-source-badge/)

This is an opinionated setup for [Jasmine](https://jasmine.github.io/), developed at [Remix](https://remix.com).

## Usage
Include this module at the top of your tests entry point (e.g. `tests.js`):
```js
import 'remix-jasmine-setup';
```

Be sure that at this point [`jasmine`](https://github.com/jasmine/jasmine) and [`jasmine-ajax`](https://github.com/jasmine/jasmine-ajax) have been loaded.

You can also use the compiled [`index.dist.js`](index.dist.js) version, e.g. in a `<script>` tag.

**IMPORTANT:** Make sure that this setup is included *before* any polyfills! Otherwise those polyfills may not get the
stubbed handles to things like `window.setTimeout`. You might need to change your [Babel](https://babeljs.io/) setup to
not include polyfills at compile-time, but instead include them manually *after* loading this setup.

Promise libraries can be especially tricky, as some of them use sophisticated methods to get really fast
asynchronous behaviour. But this setup tries to avoid any asynchronous behaviour in tests, so it needs a
Promise library that just uses `window.setTimeout` or so. We currently recommend using
[`promise-polyfill`](https://github.com/taylorhakes/promise-polyfill).

## Features

We set up Jasmine to do a bunch of things:
- Prevent tests depending on each other, or leaking state, by:
  - randomizing test order;
  - flushing the clock after each test, and making sure nothing else executes;
  - ensuring the number of DOM elements before and after each test are the same.
- Properly removing all sources of asynchronicity, by:
  - installing `jasmine.clock()` and `jasmine.Ajax()`;
  - overwriting Promises and functions like `requestAnimationFrame` to use `jasmine.clock()`;
  - making sure no Ajax requests are fired after a test runs.
- Tightening when tests fail, by:
  - catching errors that Jasmine doesn't catch by setting a global `window.onerror` handler;
  - failing a test when anything prints to the console while the test runs, to catch warnings raised by libraries.
- Finally, we add an assortment of minor niceties:
  - Reducing the pretty print depth, to avoid locking up the browser in [certain cases](https://github.com/jasmine/jasmine/issues/1291).
  - Logging the seed used for the random order, which is useful for debugging flakey tests in CI.
  - Making the window scrollable, even if there's CSS that prevents that.
  - Allowing setting `?loadConsoleReporter=true`, which prints when each test started and ended executing, which is
    useful for tracking down problems.
  - Adding `beforeTestCallbacks` and `afterTestCallbacks` arrays that can be used in application code to add some
    global state cleanup or assertions, and having them guaranteed to be called at the right times (as opposed to
    `beforeEach`/`afterEach`, which may be called too early or too late).

## Future

- Allow configuration of features.
  - Turning them on and off individually.
  - Making exceptions, e.g. to not being able to log to the console.
- Merge some of these improvements into Jasmine itself (some might already be there, we'd have to check).
- Better interoperability with polyfills.

## License
[MIT](LICENSE)
