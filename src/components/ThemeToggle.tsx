import { Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
      toast.info("Switched to Dark Mode");
    } else if (theme === "dark") {
      setTheme("amoled");
      toast.success("Switched to True AMOLED Pitch Black (OLED battery saver)");
    } else {
      setTheme("light");
      toast.info("Switched to Light Mode");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={
        theme === "amoled"
          ? "AMOLED Black (Click for Light)"
          : theme === "dark"
          ? "Dark Mode (Click for AMOLED Black)"
          : "Light Mode (Click for Dark)"
      }
      className="relative h-9 w-9 text-foreground hover:bg-muted"
    >
      {theme === "amoled" ? (
        <span className="flex items-center justify-center font-bold text-xs text-emerald-400">
          <Sparkles className="h-4 w-4" />
        </span>
      ) : theme === "dark" ? (
        <Moon className="h-4 w-4 text-primary" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

