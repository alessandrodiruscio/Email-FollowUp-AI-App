import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const AVAILABLE_VARIABLES = [
  { name: "{{original_subject}}", description: "Subject of the initial email" },
  { name: "{{name}}", description: "Recipient's name" },
  { name: "{{email}}", description: "Recipient's email address" },
  { name: "{{company}}", description: "Recipient's company name" },
];

export function VariableHelper({ onInsert }: { onInsert: (variable: string) => void }) {
  const { toast } = useToast();

  const handleCopy = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast({ title: `Copied: ${variable}` });
  };

  return (
    <div className="bg-muted/40 rounded-lg border p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">📝 Available Variables:</p>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_VARIABLES.map((variable) => (
          <div
            key={variable.name}
            className="inline-flex items-center gap-1 bg-background rounded px-2 py-1 border border-border/50 text-xs"
            title={variable.description}
          >
            <code className="font-mono text-primary font-semibold">{variable.name}</code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-primary/10"
              onClick={() => {
                onInsert(variable.name);
                toast({ title: `Inserted: ${variable.name}` });
              }}
            >
              +
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-muted"
              onClick={() => handleCopy(variable.name)}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
