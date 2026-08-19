/** Newsletter writes cross a validated server boundary. */
export async function subscribeToNewsletter(email: string): Promise<void> {
  const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  if (!response.ok) throw new Error('newsletter-subscribe-failed');
}
