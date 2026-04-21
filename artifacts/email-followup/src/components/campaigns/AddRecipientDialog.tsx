import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAddRecipient, getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional(),
});

export function AddRecipientDialog({ campaignId }: { campaignId: number }) {
  const [open, setOpen] = useState(false);
  const mutation = useAddRecipient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", company: "" }
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    mutation.mutate({ id: campaignId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        setOpen(false);
        form.reset();
        toast({ title: "Recipient added successfully" });
      },
      onError: () => toast({ title: "Failed to add recipient", variant: "destructive" })
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-md font-semibold hover-elevate bg-primary text-white">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Recipient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl bg-card">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-display font-bold">Add Recipient</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Smith" className="h-12 rounded-xl bg-muted/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@example.com" className="h-12 rounded-xl bg-muted/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Company (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" className="h-12 rounded-xl bg-muted/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-medium">Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="rounded-xl font-bold bg-primary text-white">
                {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Contact
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
