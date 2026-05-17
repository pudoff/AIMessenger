import React from 'react';

export default function ChatPageShell({ left, right, split = true }) {
  if (split) {
    return (
      <div className="workspace workspace--split">
        {left}
        {right}
      </div>
    );
  }

  // If not split, render single-column view (left or right)
  return (
    <div className="workspace workspace--messenger">
      {left || right}
    </div>
  );
}
