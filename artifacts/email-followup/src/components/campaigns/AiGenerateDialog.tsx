import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerateEmail, useGenerateFollowUp } from "@workspace/api-client-react";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const generateSchema = z.object({
  description: z.string().min(10, "Provide a bit more detail for the AI"),
  tone: z.enum(["professional", "friendly", "casual"]).default("professional"),
  recipientName: z.string().optional(),
  senderName: z.string().optional(),
});

type AiGenerateDialogProps = {
  onSuccess: (data: { subject: string, body: string }) => void;
  mode: "initial" | "followup";
  followUpContext?: {
    originalSubject: string;
    originalBody: string;
    followUpNumber: number;
  };
};

export function AiGenerateDialog({ onSuccess, mode, followUpContext }: AiGenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const generateEmailMut = useGenerateEmail();
  const generateFollowUpMut = useGenerateFollowUp();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof generateSchema>>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      description: "",
      tone: "professional",
      recipientName: "",
      senderName: ""
    }
  });

  const isPending = generateEmailMut.isPending || generateFollowUpMut.isPending;

  const onSubmit = async (values: z.infer<typeof generateSchema>) => {
    try {
      if (mode === "initial") {
        const result = await generateEmailMut.mutateAsync({ data: values });
        onSuccess(result);
      } else if (mode === "followup" && followUpContext) {
        const result = await generateFollowUpMut.mutateAsync({
          data: {
            ...followUpContext,
            description: values.description,
          }
        });
        onSuccess(result);
      }
      setOpen(false);
      form.reset();
      toast({ title: "Generated successfully!", description: "Review and tweak the text below." });
    } catch (error) {
      toast({ title: "Generation failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          type="button" 
          variant="outline" 
          className="border-accent/50 text-accent hover:bg-accent/10 hover:text-accent font-semibold rounded-xl shadow-sm hover-elevate"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl bg-card">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="w-12 h-12 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl flex items-center justify-center text-accent mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-display font-bold text-foreground">
            {mode === 'initial' ? 'AI Email Drafter' : 'AI Follow-up Drafter'}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Describe what you want to say, and let AI write the perfect {mode === 'initial' ? 'initial email' : 'follow-up'}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-semibold">What is the goal of this email?</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={mode === 'initial' ? "e.g. Introduce our new design services and ask for a 15min call..." : "e.g. Bump the thread, keep it short, add a touch of urgency"} 
                      className="resize-none h-32 rounded-xl bg-muted/50 border-muted-foreground/20 focus-visible:ring-accent/30"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'initial' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Tone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl border-muted-foreground/20">
                            <SelectValue placeholder="Select a tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-medium">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white rounded-xl font-semibold shadow-lg shadow-accent/20">
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Text
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
