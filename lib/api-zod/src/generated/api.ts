import zod from "zod";

/**
 * @summary List campaigns
 */
export const ListCampaignsResponse = zod.array(
  zod.object({
    id: zod.number(),
    name: zod.string(),
    subject: zod.string(),
    body: zod.string(),
    fromEmail: zod.string(),
    fromName: zod.string(),
    status: zod.enum(["draft", "active", "paused", "completed"]),
    emailFontSize: zod.string().optional(),
    emailFontFamily: zod.string().optional(),
    emailLineHeight: zod.string().optional(),
    footerName: zod.string().optional(),
    footerTitle: zod.string().optional(),
    footerImageUrl: zod.string().optional(),
    footerWebsite: zod.string().optional(),
    footerWebsiteUrl: zod.string().optional(),
    footerFacebook: zod.string().optional(),
    footerInstagram: zod.string().optional(),
    footerYoutube: zod.string().optional(),
    reasonId: zod.number().nullable().optional(),
    reason: zod
      .object({
        id: zod.number(),
        name: zod.string(),
        color: zod.string(),
      })
      .optional(),
    createdAt: zod.date(),
    updatedAt: zod.date(),
    recipientCount: zod.number(),
    repliedCount: zod.number(),
    sentCount: zod.number(),
    followUpCount: zod.number(),
    recipients: zod
      .array(
        zod.object({
          id: zod.number(),
          campaignId: zod.number(),
          name: zod.string(),
          email: zod.string(),
          replied: zod.boolean(),
          initialSentAt: zod.date().optional(),
        })
      )
      .optional(),
    followUpSteps: zod
      .array(
        zod.object({
          id: zod.number(),
          campaignId: zod.number(),
          stepNumber: zod.number(),
          delayValue: zod.number(),
          delayUnit: zod.string(),
          subject: zod.string(),
          body: zod.string(),
          includeFooter: zod.boolean(),
          createdAt: zod.date(),
        })
      )
      .optional(),
  })
);

/**
 * @summary Create a campaign
 */
export const CreateCampaignBody = zod.object({
  name: zod.string(),
  subject: zod.string(),
  body: zod.string(),
  fromEmail: zod.string(),
  fromName: zod.string(),
  footerName: zod.string().optional(),
  footerTitle: zod.string().optional(),
  footerImageUrl: zod.string().optional(),
  footerWebsite: zod.string().optional(),
  footerWebsiteUrl: zod.string().optional(),
  footerFacebook: zod.string().optional(),
  footerInstagram: zod.string().optional(),
  footerYoutube: zod.string().optional(),
  reasonId: zod.number().nullish(),
});

/**
 * @summary Get campaign by ID
 */
export const GetCampaignParams = zod.object({
  id: zod.coerce.number(),
});

export const GetCampaignResponse = zod.object({
  id: zod.number(),
  name: zod.string(),
  subject: zod.string(),
  body: zod.string(),
  fromEmail: zod.string(),
  fromName: zod.string(),
  status: zod.enum(["draft", "active", "paused", "completed"]),
  emailFontSize: zod.string().optional(),
  emailFontFamily: zod.string().optional(),
  emailLineHeight: zod.string().optional(),
  footerName: zod.string().optional(),
  footerTitle: zod.string().optional(),
  footerImageUrl: zod.string().optional(),
  footerWebsite: zod.string().optional(),
  footerWebsiteUrl: zod.string().optional(),
  footerFacebook: zod.string().optional(),
  footerInstagram: zod.string().optional(),
  footerYoutube: zod.string().optional(),
  reasonId: zod.number().nullable().optional(),
  reason: zod
    .object({
      id: zod.number(),
      name: zod.string(),
      color: zod.string(),
    })
    .optional(),
  createdAt: zod.date(),
  updatedAt: zod.date(),
  recipientCount: zod.number(),
  repliedCount: zod.number(),
  sentCount: zod.number(),
  recipients: zod.array(
    zod.object({
      id: zod.number(),
      campaignId: zod.number(),
      name: zod.string(),
      email: zod.string(),
      company: zod.string().optional(),
      replied: zod.boolean(),
      initialSentAt: zod.date().optional(),
    })
  ),
  followUpSteps: zod.array(
    zod.object({
      id: zod.number(),
      campaignId: zod.number(),
      stepNumber: zod.number(),
      delayValue: zod.number(),
      delayUnit: zod.string(),
      subject: zod.string(),
      body: zod.string(),
      includeFooter: zod.boolean(),
      createdAt: zod.date(),
    })
  ),
});

/**
 * @summary Update campaign
 */
export const UpdateCampaignParams = zod.object({
  id: zod.coerce.number(),
});

export const UpdateCampaignBody = zod.object({
  name: zod.string().optional(),
  subject: zod.string().optional(),
  body: zod.string().optional(),
  fromEmail: zod.string().optional(),
  fromName: zod.string().optional(),
  reasonId: zod.number().nullish(),
  status: zod.enum(["draft", "active", "completed"]).optional(),
  footerName: zod.string().optional(),
  footerTitle: zod.string().optional(),
  footerImageUrl: zod.string().optional(),
  footerWebsite: zod.string().optional(),
  footerWebsiteUrl: zod.string().optional(),
  footerFacebook: zod.string().optional(),
  footerInstagram: zod.string().optional(),
  footerYoutube: zod.string().optional(),
});

/**
 * @summary Delete campaign
 */
export const DeleteCampaignParams = zod.object({
  id: zod.coerce.number(),
});

/**
 * @summary Send campaign
 */
export const SendCampaignParams = zod.object({
  id: zod.coerce.number(),
});

/**
 * @summary List recipients
 */
export const ListRecipientsParams = zod.object({
  id: zod.coerce.number(),
});

/**
 * @summary Add recipient
 */
export const AddRecipientParams = zod.object({
  id: zod.coerce.number(),
});

export const AddRecipientBody = zod.object({
  name: zod.string(),
  email: zod.string().email("Valid email required"),
  company: zod.string().optional(),
});

/**
 * @summary Mark recipient as replied
 */
export const MarkRepliedParams = zod.object({
  id: zod.coerce.number(),
  recipientId: zod.coerce.number(),
});

export const MarkRepliedBody = zod.object({
  replied: zod.boolean(),
});

/**
 * @summary Remove recipient
 */
export const RemoveRecipientParams = zod.object({
  id: zod.coerce.number(),
  recipientId: zod.coerce.number(),
});

/**
 * @summary Get follow-up steps
 */
export const ListFollowUpStepsParams = zod.object({
  id: zod.coerce.number(),
});

/**
 * @summary Create follow-up step
 */
export const CreateFollowUpStepParams = zod.object({
  id: zod.coerce.number(),
});

export const CreateFollowUpStepBody = zod.object({
  delayValue: zod.number(),
  delayUnit: zod.enum(["minutes", "hours", "days"]),
  subject: zod.string(),
  body: zod.string(),
  includeFooter: zod.boolean().default(true),
  stepNumber: zod.number().optional(),
});

/**
 * @summary Update a follow-up step
 */
export const UpdateFollowUpStepParams = zod.object({
  id: zod.coerce.number(),
  stepId: zod.coerce.number(),
});

export const UpdateFollowUpStepBody = zod.object({
  delayValue: zod.number().optional(),
  delayUnit: zod.enum(["minutes", "hours", "days"]).optional(),
  subject: zod.string().optional(),
  body: zod.string().optional(),
  includeFooter: zod.boolean().optional(),
});

/**
 * @summary Delete follow-up step
 */
export const DeleteFollowUpStepParams = zod.object({
  id: zod.coerce.number(),
  stepId: zod.coerce.number(),
});

/**
 * @summary List reasons
 */
export const ListReasonsResponse = zod.array(
  zod.object({
    id: zod.number(),
    name: zod.string(),
    color: zod.string(),
  })
);

/**
 * @summary Create a reason
 */
export const CreateReasonBody = zod.object({
  name: zod.string(),
  color: zod.string(),
});

/**
 * @summary Update a reason
 */
export const UpdateReasonParams = zod.object({
  id: zod.coerce.number(),
});

export const UpdateReasonBody = zod.object({
  name: zod.string().optional(),
  color: zod.string().optional(),
});

/**
 * @summary Delete a reason
 */
export const DeleteReasonParams = zod.object({
  id: zod.coerce.number(),
});

/**
 * @summary Send a test email for a campaign
 */
export const SendTestEmailParams = zod.object({
  id: zod.coerce.number(),
});

export const SendTestEmailBody = zod.object({
  testEmail: zod.string().email("Valid email required"),
  stepNumber: zod.number().optional(),
});

export const SendTestEmailResponse = zod.object({
  success: zod.boolean(),
  message: zod.string(),
});

/**
 * @summary Get email events for a recipient
 */
export const GetEmailEventsParams = zod.object({
  id: zod.coerce.number(),
  recipientId: zod.coerce.number(),
});

export const EmailEventResponse = zod.object({
  id: zod.number(),
  messageId: zod.string().optional(),
  stepNumber: zod.number().optional(),
  sentAt: zod.date(),
  opened: zod.boolean(),
  openedAt: zod.date().optional(),
  clicked: zod.boolean(),
  clickedAt: zod.date().optional(),
  allEvents: zod.array(
    zod.object({
      id: zod.number(),
      sentEmailId: zod.number(),
      messageId: zod.string(),
      eventType: zod.enum(["sent", "opened", "clicked", "bounced", "complained", "unsubscribed"]),
      timestamp: zod.date(),
      metadata: zod.string().optional(),
      createdAt: zod.date(),
    })
  ),
});

export const GetEmailEventsResponse = zod.array(EmailEventResponse);

/**
 * @summary Health check
 */
export const HealthCheckResponse = zod.object({
  status: zod.string(),
});

/**
 * @summary Generate email using AI
 */
export const GenerateEmailBody = zod.object({
  description: zod.string(),
  recipientName: zod.string().optional(),
  senderName: zod.string().optional(),
  tone: zod.string().optional(),
});

/**
 * @summary Generate follow-up email using AI
 */
export const GenerateFollowUpBody = zod.object({
  followUpNumber: zod.number(),
  originalSubject: zod.string(),
  originalBody: zod.string(),
  description: zod.string().optional(),
});
