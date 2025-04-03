
export class MoveDto {
    from: string;       // Square notation (e.g., "e2")
    to: string;         // Square notation (e.g., "e4")
    promotion?: string; // Optional promotion piece (e.g., "q", "r", "b", "n")
    san?: string;       // Standard Algebraic Notation (e.g., "e4")
    lan?: string;       // Long Algebraic Notation (e.g., "e2e4")
    
    // Optional metadata
    timestamp?: Date;   // When the move was made
    clock?: number;     // Time remaining in milliseconds
  }