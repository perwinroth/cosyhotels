import ShareButton from "../../src/components/ShareButton";

export const Pill = () => <ShareButton title="Hotel Stelor" url="https://gotcosy.com/en/hotels/hotel-stelor" />;
export const IconFullWidth = () => (
  <div style={{ maxWidth: 360 }}>
    <ShareButton variant="icon" block title="Hotel Stelor" url="https://gotcosy.com/en/hotels/hotel-stelor" label="Share" />
  </div>
);
