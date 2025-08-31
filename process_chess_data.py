import ast
import json
import re
from json_repair import repair_json

def process_chess_data(input_file, output_file):
    """Process chess mistake data from output.txt into clean JSON format."""
    
    processed_data = []
    
    with open(input_file, 'r') as f:
        lines = f.readlines()
    
    entry_id = 0
    for line in lines:
        if not line.strip():
            continue
            
        try:
            # Each line is a complete Python tuple: (dict, 'analysis_text')
            # Use ast.literal_eval to parse the entire tuple
            tuple_data = ast.literal_eval(line.strip())
            
            if isinstance(tuple_data, tuple) and len(tuple_data) == 2:
                position_data = tuple_data[0]  # First element is the dictionary
                analysis_text = tuple_data[1]   # Second element is the analysis text
                
                # Extract the JSON part with motifs from the analysis text
                json_match = re.search(r'```json\s*(\{.*?\})\s*```', analysis_text, re.DOTALL)
                analysis_data = {}
                
                if json_match:
                    json_str = json_match.group(1)
                    # Use json_repair to fix any JSON issues
                    try:
                        repaired_json = repair_json(json_str)
                        analysis_data = json.loads(repaired_json)
                    except Exception as e:
                        print(f"Failed to parse JSON for entry {entry_id}: {e}")
                        # Fallback - try to extract motifs manually
                        motif_match = re.search(r'"possible_motifs":\s*\[(.*?)\]', json_str)
                        if motif_match:
                            motif_str = motif_match.group(1)
                            motifs = re.findall(r'"([^"]+)"', motif_str)
                            analysis_data = {
                                "possible_motifs": motifs,
                                "reasoning": "Partial extraction",
                                "game_state": "unknown"
                            }
                        else:
                            analysis_data = {
                                "possible_motifs": [],
                                "reasoning": "Parse error",
                                "game_state": "unknown"
                            }
                else:
                    # No JSON block found, set defaults
                    print(f"No JSON found in entry {entry_id}")
                    analysis_data = {
                        "possible_motifs": [],
                        "reasoning": "No analysis found",
                        "game_state": "unknown"
                    }
                
                # Combine the data into a clean structure
                processed_entry = {
                    "id": entry_id,
                    "position": {
                        "fen": position_data.get('position_fen', ''),
                        "move_number": position_data.get('move_number', 0),
                        "game_state": analysis_data.get('game_state', 'unknown')
                    },
                    "moves": {
                        "actual": position_data.get('actual_move_played', ''),
                        "best": position_data.get('best_move', ''),
                        "actual_line": position_data.get('actual_move_inferior_line', ''),
                        "best_line": position_data.get('best_move_line', '')
                    },
                    "evaluation": {
                        "after_actual": position_data.get('eval_after_actual_move', 0),
                        "after_best": position_data.get('eval_after_best_move', 0),
                        "difference": position_data.get('eval_difference', 0),
                        "quality": position_data.get('move_quality', 'unknown')
                    },
                    "analysis": {
                        "motifs": analysis_data.get('possible_motifs', []),
                        "reasoning": analysis_data.get('reasoning', '')
                    },
                    "is_player_move": position_data.get('is_player_move', True)
                }
                
                processed_data.append(processed_entry)
                entry_id += 1
                
        except Exception as e:
            print(f"Error processing entry {entry_id}: {e}")
            print(f"Line preview: {line[:100]}...")
            continue
    
    # Write the processed data to JSON file
    with open(output_file, 'w') as f:
        json.dump(processed_data, f, indent=2)
    
    print(f"\nSuccessfully processed {len(processed_data)} chess positions")
    print(f"Output saved to {output_file}")
    
    # Print statistics
    motif_counts = {}
    game_state_counts = {}
    quality_counts = {}
    
    for entry in processed_data:
        for motif in entry['analysis']['motifs']:
            motif_counts[motif] = motif_counts.get(motif, 0) + 1
        game_state = entry['position']['game_state']
        game_state_counts[game_state] = game_state_counts.get(game_state, 0) + 1
        quality = entry['evaluation']['quality']
        quality_counts[quality] = quality_counts.get(quality, 0) + 1
    
    if motif_counts:
        print("\n📊 Top Tactical Motifs:")
        for motif, count in sorted(motif_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
            bar = '█' * int(count/2)
            print(f"  {motif:<20} {bar} {count}")
    else:
        print("\n⚠️ No motifs found in data")
    
    print("\n🎯 Game Phase Distribution:")
    for state, count in game_state_counts.items():
        percentage = (count / len(processed_data)) * 100
        print(f"  {state:<12} {count:3} ({percentage:.1f}%)")
    
    print("\n⚠️ Move Quality Distribution:")
    for quality, count in quality_counts.items():
        percentage = (count / len(processed_data)) * 100
        print(f"  {quality:<12} {count:3} ({percentage:.1f}%)")
    
    # Print sample entry for verification
    if processed_data:
        print("\n✅ Sample processed entry:")
        sample = processed_data[0]
        print(f"  Position: {sample['position']['fen'][:50]}...")
        print(f"  Move: {sample['moves']['actual']} (best: {sample['moves']['best']})")
        print(f"  Eval diff: {sample['evaluation']['difference']}")
        print(f"  Motifs: {sample['analysis']['motifs']}")
        print(f"  Game state: {sample['position']['game_state']}")

if __name__ == "__main__":
    process_chess_data('output.txt', 'chess_mistakes.json')