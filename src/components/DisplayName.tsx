import type { mastodon } from "masto";
import { replaceEmojisWithImages } from "../utils/emoji";

interface DisplayNameProps {
  account: mastodon.v1.Account;
  className?: string;
}

/**
 * Renders an account's display name with custom emoji support.
 * If the account has custom emojis, they will be rendered as images.
 * Otherwise, the display name is rendered as plain text.
 */
export function DisplayName({ account, className }: DisplayNameProps) {
  const hasEmojis = account.emojis && account.emojis.length > 0;

  if (hasEmojis) {
    const html = replaceEmojisWithImages(account.displayName, account.emojis);
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <span className={className}>{account.displayName}</span>;
}
