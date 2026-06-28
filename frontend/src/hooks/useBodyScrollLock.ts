import { useEffect } from 'react';

/**
 * Hook to lock/unlock body and html scroll based on a boolean flag.
 * Uses position: fixed approach to prevent background scrolling while
 * still allowing scrolling inside modals and dropdowns on mobile.
 */
export const useBodyScrollLock = (lock: boolean) => {
  useEffect(() => {
    if (lock) {
      // Save current scroll position
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      // Lock the body in place using position: fixed
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = `-${scrollX}px`;
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.width = '100%';

      // Store scroll position for restoration
      document.body.dataset.scrollY = scrollY.toString();
      document.body.dataset.scrollX = scrollX.toString();
    } else {
      // Restore scroll position
      const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
      const scrollX = parseInt(document.body.dataset.scrollX || '0', 10);

      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.body.style.width = '';

      window.scrollTo(scrollX, scrollY);
    }

    // Cleanup on unmount
    return () => {
      const scrollY = parseInt(document.body.dataset.scrollY || '0', 10);
      const scrollX = parseInt(document.body.dataset.scrollX || '0', 10);

      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      document.body.style.width = '';

      window.scrollTo(scrollX, scrollY);
    };
  }, [lock]);
};
