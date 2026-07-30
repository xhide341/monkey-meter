import { useState, useCallback, type ReactNode } from "react";

interface ControlButtonProps {
  className: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

export default function ControlButton({
  className,
  onClick,
  disabled = false,
  children,
}: ControlButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const releasePress = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handlePointerDown = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  return (
    <button
      className={`${className}${isPressed ? " is-pressed" : ""}`}
      onClick={onClick}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={releasePress}
      onPointerLeave={releasePress}
      onPointerCancel={releasePress}
      onBlur={releasePress}
    >
      {children}
    </button>
  );
}
