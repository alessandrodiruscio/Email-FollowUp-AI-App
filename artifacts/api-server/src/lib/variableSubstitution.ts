/**
 * Substitute variables in text with actual values
 * Supports: {{original_subject}}, {{name}}, {{email}}, {{company}}
 */
export function substituteVariables(
  text: string,
  options: {
    original_subject?: string;
    name?: string;
    email?: string;
    company?: string;
  }
): string {
  let result = text;
  
  if (options.original_subject !== undefined) {
    result = result.replace(/\{\{original_subject\}\}/g, options.original_subject || "");
  }
  
  if (options.name !== undefined) {
    result = result.replace(/\{\{name\}\}/g, options.name || "");
  }
  
  if (options.email !== undefined) {
    result = result.replace(/\{\{email\}\}/g, options.email || "");
  }
  
  if (options.company !== undefined) {
    result = result.replace(/\{\{company\}\}/g, options.company || "");
  }
  
  return result;
}
