import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Key, Bell, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" description="Manage your profile and preferences" />

      <div className="space-y-6">
        {/* Theme */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" /> Appearance
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200 ${
                  theme === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Profile */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
              <Input defaultValue="Developer" className="bg-secondary border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <Input defaultValue="dev@example.com" className="bg-secondary border-border text-foreground" />
            </div>
          </div>
        </motion.div>

        {/* API Keys */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> API Configuration
          </h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">GitHub Token (optional)</label>
            <Input type="password" placeholder="ghp_xxxxxxxxxxxx" className="bg-secondary border-border text-foreground placeholder:text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-1">Used for private repository access and higher rate limits.</p>
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-lg p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </h2>
          <p className="text-sm text-muted-foreground">Notification preferences coming soon.</p>
        </motion.div>

        <Button className="gradient-primary text-primary-foreground hover:opacity-90">Save Changes</Button>
      </div>
    </div>
  );
};

export default SettingsPage;
