import { onBeforeUnmount } from 'vue';
import { useHistoryStore } from '@/store/historyStore';

/**
 * 用于连续拖动（如滑块）时只在结束时记录一次快照。
 * 通过锁定历史记录阻止过程中 pushSnapshot，结束时主动 push 一次。
 */
export function useContinuousHistory() {
  const history = useHistoryStore();

  let unlockHistory: (() => void) | null = null;

  const removeEndListeners = () => {
    window.removeEventListener('mouseup', handleEnd);
    window.removeEventListener('touchend', handleEnd);
    window.removeEventListener('touchcancel', handleEnd);
  };

  const handleEnd = () => {
    // 只在一次拖动流程结束时解锁并记录快照
    if (!unlockHistory) {
      removeEndListeners();
      return;
    }
    const unlock = unlockHistory;
    unlockHistory = null;
    removeEndListeners();
    unlock();
    history.pushSnapshot();
  };

  const handleStart = () => {
    if (unlockHistory) return; // 已在拖动中
    unlockHistory = history.lockHistoryWithoutSnapshot();
    window.addEventListener('mouseup', handleEnd, { once: true });
    window.addEventListener('touchend', handleEnd, { once: true });
    window.addEventListener('touchcancel', handleEnd, { once: true });
  };

  onBeforeUnmount(() => {
    removeEndListeners();
    if (unlockHistory) {
      unlockHistory();
      unlockHistory = null;
    }
  });

  // 可直接用于 v-on 绑定
  const sliderListeners = {
    mousedown: handleStart,
    touchstart: handleStart,
  };

  return {
    handleStart,
    handleEnd,
    sliderListeners,
  };
}
