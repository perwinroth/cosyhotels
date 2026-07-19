import SaveToTripButton from "../../src/components/SaveToTripButton";

const labels = {
  save: "Save to collection", saveShort: "Save", added: "Added", emailPrompt: "Want to find your collections later?",
  emailLabel: "Email", emailPlaceholder: "you@example.com", consent: "Email me my collection link",
  titleLabel: "Collection name", titlePlaceholder: "Summer in Gotland", submit: "Save", cancel: "Cancel",
  copyLink: "Copy link", copied: "Copied", viewPlan: "View collection", yourPrivateLink: "Your private link",
  emailInvalid: "That email does not look right", genericError: "Something went wrong, try again",
  marketingConsent: "Send me occasional cosy finds", findByEmail: "Find my collections",
};

export const Default = () => <SaveToTripButton hotelSlug="hotel-stelor" locale="en" labels={labels} />;
export const CompactFullWidth = () => (
  <div style={{ maxWidth: 360 }}>
    <SaveToTripButton variant="compact" block hotelSlug="hotel-stelor" locale="en" labels={labels} />
  </div>
);
