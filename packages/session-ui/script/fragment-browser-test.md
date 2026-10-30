# Fragment navigation regression and emulator limitation

The added Happy DOM location assertion failed while `event.defaultPrevented` was already true: expected `about:blank`, received `about:blank#usage`. The exact assertion was `expect(window.location.href).toBe(before)` after dispatching a cancelable bubbling click on a nested span in an anchor. This failure is retained as a known emulator limitation, not claimed fixed. The DOM unit test retains target lookup, prevention, scroller invocation, invalid URI, and cleanup assertions.

No-navigation acceptance belongs to the real browser. `verify-fragment-links.mjs` repeats that assertion against the exact bundled production helper, plus duplicate-heading position, malformed URI handling and cleanup. It aborts network requests, uses a temporary browser profile and closes it on exit. It does not download a browser. Run with installed executables:

```
HARISHCODE_TEST_CHROMIUM=/path/to/chrome HARISHCODE_TEST_BUN=/path/to/bun node packages/session-ui/script/verify-fragment-links.mjs
```

Only on a host where the browser cannot use its sandbox, explicitly add `HARISHCODE_TEST_NO_SANDBOX=1`. This is an isolated helper regression, not a whole-app browser or security test. A successful real-browser result does not erase the Happy DOM mismatch or other unverified behavior.
