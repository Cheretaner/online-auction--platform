import { aiProviderAdapter } from "../infrastructure/ai/provider.adapter.js";
import * as biddingRepo from "../bidding/bidding.repository.js";
import * as documentSearchRepo from "../document/document-search.repository.js";

export async function askAssistant(
  prompt: string,
  auctionId?: string,
): Promise<{ answer: string; provider: string; fallback: boolean }> {
  let context = prompt;
  
  if (auctionId) {
    const auction = await biddingRepo.findAuction(auctionId);
    if (auction) {
      context = `Auction "${auction.title}" status=${auction.status} type=${auction.auctionType} bids=${auction.bidCount} highest=${auction.currentHighestBid}`;
      
      // Enhance context with relevant document snippets from OCR
      try {
        const documentSnippets = await documentSearchRepo.getDocumentSnippetsForAssistant(
          prompt,
          auctionId,
          3, // Top 3 relevant documents
        );
        
        if (documentSnippets.length > 0) {
          context += '\n\nRelevant document excerpts:';
          for (const snippet of documentSnippets) {
            context += `\n- ${snippet.filename}: ${snippet.snippet}`;
          }
        }
      } catch (error) {
        // Don't fail assistant if document search fails
      }
      
      context += `\n\n${prompt}`;
    }
  }
  
  return aiProviderAdapter.assist(context);
}
