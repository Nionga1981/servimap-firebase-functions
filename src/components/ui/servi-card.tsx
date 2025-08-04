// ServiCard - Material Design 3 Card Component for ServiMap
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ServiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'filled' | 'outlined';
  interactive?: boolean;
  padding?: 'none' | 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export const ServiCard = forwardRef<HTMLDivElement, ServiCardProps>(
  ({ 
    variant = 'elevated',
    interactive = false,
    padding = 'medium',
    className,
    children,
    onClick,
    ...props
  }, ref) => {
    
    // Base styles with Material 3 principles
    const baseStyles = 'transition-all duration-200 bg-white';
    
    // Variant styles
    const variants = {
      elevated: 'shadow-md hover:shadow-lg rounded-xl',
      filled: 'bg-gray-50 rounded-xl',
      outlined: 'border border-gray-200 rounded-xl hover:border-gray-300'
    };
    
    // Padding styles
    const paddings = {
      none: 'p-0',
      small: 'p-3',
      medium: 'p-4',
      large: 'p-6'
    };
    
    // Interactive styles
    const interactiveStyles = interactive 
      ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] select-none' 
      : '';
    
    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          paddings[padding],
          interactiveStyles,
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ServiCard.displayName = 'ServiCard';

// Compound Components for better composition
interface ServiCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ServiCardHeader = forwardRef<HTMLDivElement, ServiCardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('pb-3 border-b border-gray-100', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ServiCardHeader.displayName = 'ServiCardHeader';

interface ServiCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  subtitle?: string;
}

export const ServiCardTitle = forwardRef<HTMLHeadingElement, ServiCardTitleProps>(
  ({ className, children, subtitle, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <h3 
          ref={ref}
          className={cn('text-lg font-semibold text-gray-900', className)}
          {...props}
        >
          {children}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
    );
  }
);

ServiCardTitle.displayName = 'ServiCardTitle';

interface ServiCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ServiCardContent = forwardRef<HTMLDivElement, ServiCardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('py-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ServiCardContent.displayName = 'ServiCardContent';

interface ServiCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ServiCardFooter = forwardRef<HTMLDivElement, ServiCardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('pt-3 border-t border-gray-100 flex items-center justify-between', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ServiCardFooter.displayName = 'ServiCardFooter';

// Media Card Variant
interface ServiCardMediaProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  aspectRatio?: '16/9' | '4/3' | '1/1' | '3/2';
}

export const ServiCardMedia: React.FC<ServiCardMediaProps> = ({
  aspectRatio = '16/9',
  className,
  alt,
  src,
  ...props
}) => {
  const aspectRatios = {
    '16/9': 'aspect-video',
    '4/3': 'aspect-[4/3]',
    '1/1': 'aspect-square',
    '3/2': 'aspect-[3/2]'
  };
  
  return (
    <div className={cn('overflow-hidden rounded-t-xl -m-4 mb-4', aspectRatios[aspectRatio])}>
      <img 
        src={src}
        alt={alt}
        className={cn('w-full h-full object-cover', className)}
        {...props}
      />
    </div>
  );
};

// Action Area for clickable cards
interface ServiCardActionAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ServiCardActionArea: React.FC<ServiCardActionAreaProps> = ({
  className,
  children,
  onClick,
  ...props
}) => {
  return (
    <div
      className={cn(
        'relative -m-4 p-4 cursor-pointer transition-colors hover:bg-gray-50/50 rounded-xl',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

// Export all card variants
export const ServiCardVariants = {
  Card: ServiCard,
  Header: ServiCardHeader,
  Title: ServiCardTitle,
  Content: ServiCardContent,
  Footer: ServiCardFooter,
  Media: ServiCardMedia,
  ActionArea: ServiCardActionArea
};