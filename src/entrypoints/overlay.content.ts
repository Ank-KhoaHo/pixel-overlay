// Stub from Task 1. Injected on icon click, or registered for kept sites (Task 6).
export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    console.info('[pixel-overlay] content script loaded');
  },
});
