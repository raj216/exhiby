import { useEffect, useRef } from "react";

let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";
  }
  lockCount++;
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.documentElement.style.overflow = "";
    window.scrollTo(0, savedScrollY);
  }
}

export function useScrollLock(isLocked: boolean) {
  const holdsLock = useRef(false);

  useEffect(() => {
    if (isLocked && !holdsLock.current) {
      applyLock();
      holdsLock.current = true;
    } else if (!isLocked && holdsLock.current) {
      releaseLock();
      holdsLock.current = false;
    }

    return () => {
      if (holdsLock.current) {
        releaseLock();
        holdsLock.current = false;
      }
    };
  }, [isLocked]);
}
