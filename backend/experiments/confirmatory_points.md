some ideas for test cases code-

compare groceries jan 2024 - april 2024 vs jan 25 - apr 2025
compare groceries 11/2024 - 04/2025 vs 11/2025-04/2026
tell me about top 10 expenses from feb 2024 to jan 2026 (exclude rent tho)
show breakdown of all expenses for mar 2026 (exclude rent tho)




som ideas for expense benchmark code-

at the end of each run for a particular model, we need to display the accuracies for that model


test config - 

n_types of tests = 2 (single agent, dual agent structure)
n_test_cases = 102
n_models = 5
n_runs = 5 (to be confirmed)

total runs = 5100

ag time for a run = 5s (unsure if this holds can be quite varying across 1s - 11s; averaged to obtain 5)

total time for all tests to run =  25000s = 7 hrs approx.? (set it overnight)

other configs 
tempaerature
top p 
top k
max tokens



time vs accuracy assumption good enough?

need to account for difficulty of problems like "tell me the spending on new years eve" as the llm needs to know that 31/12 is NYE