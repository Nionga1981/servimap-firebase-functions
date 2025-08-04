// ServiButton - Material Design 3 Button Component for ServiMap
import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface RippleProps {
  x: number;
  y: number;
}

interface ServiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text' | 'elevated' | 'tonal';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'success';
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  ripple?: boolean;
  children: React.ReactNode;
}

// Ripple Effect Component
const Ripple: React.FC<{ ripples: RippleProps[] }> = ({ ripples }) => {
  return (
    <>
      {ripples.map((ripple, index) => (
        <span
          key={index}
          className="absolute bg-white/30 rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x - 50,
            top: ripple.y - 50,
            width: 100,
            height: 100,
          }}
        />
      ))}
    </>
  );
};

export const ServiButton = forwardRef<HTMLButtonElement, ServiButtonProps>(
  ({ 
    variant = 'filled',
    size = 'medium',
    color = 'primary',
    startIcon,
    endIcon,
    fullWidth = false,
    disabled = false,
    loading = false,
    ripple = true,
    children,
    className,
    onClick,
    ...props 
  }, ref) => {
    const [ripples, setRipples] = useState<RippleProps[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (ripple && !disabled && !loading) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setRipples([...ripples, { x, y }]);
        setTimeout(() => {
          setRipples((prevRipples) => prevRipples.slice(1));
        }, 600);
      }
      
      onClick?.(e);
    };
    
    // Base styles
    const baseStyles = 'relative inline-flex items-center justify-center font-medium transition-all duration-200 overflow-hidden group';
    
    // Variant styles with Material 3 design
    const variants = {
      filled: {
        primary: 'bg-[#209ded] text-white hover:shadow-md active:shadow-sm hover:bg-[#1a7fc4]',
        secondary: 'bg-teal-600 text-white hover:shadow-md active:shadow-sm hover:bg-teal-700',
        tertiary: 'bg-orange-600 text-white hover:shadow-md active:shadow-sm hover:bg-orange-700',
        error: 'bg-red-600 text-white hover:shadow-md active:shadow-sm hover:bg-red-700',
        success: 'bg-green-600 text-white hover:shadow-md active:shadow-sm hover:bg-green-700'
      },
      outlined: {
        primary: 'border-2 border-[#209ded] text-[#209ded] hover:bg-[#209ded]/5 active:bg-[#209ded]/10',
        secondary: 'border-2 border-teal-600 text-teal-600 hover:bg-teal-600/5 active:bg-teal-600/10',
        tertiary: 'border-2 border-orange-600 text-orange-600 hover:bg-orange-600/5 active:bg-orange-600/10',
        error: 'border-2 border-red-600 text-red-600 hover:bg-red-600/5 active:bg-red-600/10',
        success: 'border-2 border-green-600 text-green-600 hover:bg-green-600/5 active:bg-green-600/10'
      },
      text: {
        primary: 'text-[#209ded] hover:bg-[#209ded]/5 active:bg-[#209ded]/10',
        secondary: 'text-teal-600 hover:bg-teal-600/5 active:bg-teal-600/10',
        tertiary: 'text-orange-600 hover:bg-orange-600/5 active:bg-orange-600/10',
        error: 'text-red-600 hover:bg-red-600/5 active:bg-red-600/10',
        success: 'text-green-600 hover:bg-green-600/5 active:bg-green-600/10'
      },
      elevated: {
        primary: 'bg-gray-50 text-[#209ded] shadow-sm hover:shadow-md active:shadow-sm',
        secondary: 'bg-gray-50 text-teal-600 shadow-sm hover:shadow-md active:shadow-sm',
        tertiary: 'bg-gray-50 text-orange-600 shadow-sm hover:shadow-md active:shadow-sm',
        error: 'bg-gray-50 text-red-600 shadow-sm hover:shadow-md active:shadow-sm',
        success: 'bg-gray-50 text-green-600 shadow-sm hover:shadow-md active:shadow-sm'
      },
      tonal: {
        primary: 'bg-[#209ded]/10 text-[#209ded] hover:bg-[#209ded]/20 active:bg-[#209ded]/15',
        secondary: 'bg-teal-600/10 text-teal-600 hover:bg-teal-600/20 active:bg-teal-600/15',
        tertiary: 'bg-orange-600/10 text-orange-600 hover:bg-orange-600/20 active:bg-orange-600/15',
        error: 'bg-red-600/10 text-red-600 hover:bg-red-600/20 active:bg-red-600/15',
        success: 'bg-green-600/10 text-green-600 hover:bg-green-600/20 active:bg-green-600/15'
      }
    };
    
    // Size styles with Material 3 heights
    const sizes = {
      small: 'h-8 px-3 text-sm gap-1.5 rounded-full',
      medium: 'h-10 px-6 text-base gap-2 rounded-full',
      large: 'h-12 px-8 text-lg gap-2.5 rounded-full'
    };
    
    // Get the appropriate variant style
    const variantStyle = variants[variant][color];
    const sizeStyle = sizes[size];
    
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyle,
          sizeStyle,
          fullWidth && 'w-full',
          (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {/* Loading State */}
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            <span>Cargando...</span>
          </>
        ) : (
          <>
            {/* Start Icon */}
            {startIcon && (
              <span className="flex transition-transform group-hover:scale-110">
                {startIcon}
              </span>
            )}
            
            {/* Button Text */}
            <span className="relative z-10">{children}</span>
            
            {/* End Icon */}
            {endIcon && (
              <span className="flex transition-transform group-hover:scale-110">
                {endIcon}
              </span>
            )}
          </>
        )}
        
        {/* Ripple Effect */}
        {ripple && !disabled && !loading && <Ripple ripples={ripples} />}
      </button>
    );
  }
);

ServiButton.displayName = 'ServiButton';

// Export variants for Storybook or documentation
export const serviButtonVariants = {
  variants: ['filled', 'outlined', 'text', 'elevated', 'tonal'],
  sizes: ['small', 'medium', 'large'],
  colors: ['primary', 'secondary', 'tertiary', 'error', 'success']
};