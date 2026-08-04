export function createSubmissionGuard() {
  let locked = false;
  return {
    tryLock() {
      if (locked) return false;
      locked = true;
      return true;
    },
    unlock() {
      locked = false;
    },
  };
}
