import sqlite3
import random

def generate_mock_data():
    conn = sqlite3.connect('../data/cutoffs.db')
    cursor = conn.cursor()
    
    # Fetch all 2025 R1 data
    cursor.execute("SELECT college_code, college_name, course_name, category, cutoff_rank FROM cutoffs WHERE year='2025' AND round='1'")
    base_data = cursor.fetchall()
    
    years_rounds = [
        ('2023', '1'), ('2023', '2'), ('2023', '3'),
        ('2024', '1'), ('2024', '2'), ('2024', '3'),
        ('2025', '2'), ('2025', '3')
    ]
    
    insert_query = """
    INSERT INTO cutoffs (year, round, college_code, college_name, course_name, category, cutoff_rank)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    
    new_rows = 0
    for year, round_num in years_rounds:
        for row in base_data:
            code, name, course, category, rank = row
            try:
                rank_int = int(rank)
                
                # Mock logic: Cutoffs generally increase in later rounds (meaning rank goes higher)
                # Cutoffs might vary year over year
                round_factor = int(round_num) * random.uniform(1.05, 1.15)
                year_diff = 2025 - int(year)
                year_factor = 1.0 - (year_diff * 0.05) # older years were slightly more competitive (lower ranks)
                
                new_rank = int(rank_int * round_factor * year_factor)
                
                cursor.execute(insert_query, (year, round_num, code, name, course, category, str(new_rank)))
                new_rows += 1
            except ValueError:
                # If rank is not an integer (e.g. '--'), just copy it
                cursor.execute(insert_query, (year, round_num, code, name, course, category, rank))
                new_rows += 1
                
    conn.commit()
    conn.close()
    print(f"Successfully generated {new_rows} rows of mock data for 2023-2025.")

if __name__ == "__main__":
    generate_mock_data()
