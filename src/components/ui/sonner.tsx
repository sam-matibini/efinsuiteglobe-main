import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-[#0f172a] group-[.toaster]:border-l-4 group-[.toaster]:border-l-[#6366f1] group-[.toaster]:shadow-[0_8px_32px_rgba(99,102,241,0.2)]",
          success: "group-[.toaster]:border-l-[#22c55e]",
          error: "group-[.toaster]:border-l-[#ef4444]",
          warning: "group-[.toaster]:border-l-[#f59e0b]",
          info: "group-[.toaster]:border-l-[#6366f1]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
