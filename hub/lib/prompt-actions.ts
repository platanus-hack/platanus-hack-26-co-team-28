export type PromptActionDependencies = {
  writeText: (text: string) => Promise<void>;
  openDestination: (url: string) => void;
};

export async function copyPromptThenMaybeOpen({
  destinationUrl,
  openAfterCopy,
  prompt,
  dependencies,
}: {
  destinationUrl: string;
  openAfterCopy: boolean;
  prompt: string;
  dependencies: PromptActionDependencies;
}) {
  await dependencies.writeText(prompt);
  if (openAfterCopy) dependencies.openDestination(destinationUrl);
}
