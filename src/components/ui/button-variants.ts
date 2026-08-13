import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-35 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 press-effect",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85 shadow-[0_1px_2px_hsl(0_0%_0%/0.3),0_0_16px_hsl(263_84%_58%/0.15)] hover:shadow-[0_2px_4px_hsl(0_0%_0%/0.3),0_0_24px_hsl(263_84%_58%/0.2)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_1px_2px_hsl(0_0%_0%/0.3)]",
        outline: "border border-border/60 bg-transparent hover:bg-muted/40 hover:border-primary/20 text-foreground",
        secondary: "bg-secondary/80 text-secondary-foreground hover:bg-secondary border border-border/40 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)]",
        ghost: "hover:bg-muted/40 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-[0.8125rem]",
        lg: "h-12 rounded-lg px-8 text-[0.9375rem]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
