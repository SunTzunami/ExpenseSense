Paper Decision
Decisionby Program Chairs27 Jul 2026, 08:36 (modified: 27 Jul 2026, 18:26)Program Chairs, Reviewers, AuthorsRevisions
Decision: Accept (Poster)
Comment:
We recommend acceptance. ExpenseSense presents a practical and well-motivated approach to private, on-device financial assistants, with useful comparisons between single- and dual-agent architectures and a thoughtful error analysis. The paper should be careful not to overstate the dual-agent advantage, since its benefits are metric-specific, and should clarify the benchmark construction and compare the router against simpler intent-classification baselines. The camera-ready also needs a thorough formatting pass: remove the stray line numbers in the template and place figures closer to the relevant results.

Interesting use case, more clarity would be helpful!
Official Reviewby Reviewer xhAs18 Jul 2026, 04:51 (modified: 27 Jul 2026, 18:32)Program Chairs, Reviewers Submitted, Reviewer xhAs, AuthorsRevisions
Review:
This paper targets privacy-preserving personal finance assistants by using sub-2B LLMs hosted locally on the client's computers. The authors experiment with a single-agent (the same agent must identify both the user intent and the tool call) and a dual-agent (an intent-based router agent and then a tool selection agent) setting. The authors test these two settings under a 115-item test set for financial queries, and find that the dual-agent setting could improve correctness ratio and latency over the single-agent setting.

Strengths:

The authors present an interesting direction for on-device assistants
The authors leveraged a good set of models for their experiments
The benchmark, if publicly available, would be very beneficial to people conducting research in this space
Weaknesses:

The task does not feel inherently dual-agent; a possible baseline would be to contrast the intent router agent with a common retriever / intent classifier (compare the semantic similarity between user utterance and descriptions of different tools)
The single-agent setting can actually out-perform the dual-agent setting on task accuracy, therefore the authors' claim that dual agent performs better is metric-specific and that should be better clarified in the paper
Comments:

The application of the template appears incorrect; there are line numbers between the columns which should not be the case
The main results figures should be closer to the results section instead of in the discussion section; LaTeX is fickle so the authors would likely need to experiment with figure placements more for future revisions
It would be helpful if the authors could provide the prompts used for dual-agent settings
How was your benchmark sourced? No detail was provided in this regard.
Rating: 6: Marginally above acceptance threshold
Confidence: 3: The reviewer is fairly confident that the evaluation is correct
Relevance To Haips: 4: Good fit for HAIPS; the paper is substantially aligned with the workshop's themes
ExpenseSense Review
Official Reviewby Reviewer dgYW13 Jul 2026, 21:16 (modified: 27 Jul 2026, 18:32)Program Chairs, Reviewers Submitted, Reviewer dgYW, AuthorsRevisions
Review:
This paper presents ExpenseSense, an on-device, privacy-preserving personal finance assistant using several small language models, motivated by the privacy risk of cloud-based financial assistants. They compare their system using single-agent and dual-agent pipelines on a newly constructed 115-question test benchmark spanning five financial analysis tools. Their results show the improved performance of dual-agent systems over single-agent systems for correctness, reduced latency, and safer errors. Importantly, they demonstrate the viability of local, specialized assistants.

Strengths:

Strong privacy motivation with practical deployment focus: The paper addresses the important problem of making a financial assistant that does not rely on a cloud-hosted interface, which could potentially expose a user to data leakage. This goal is emphasized repeatedly through the paper with the usage of SLMs that could run easily on consumer hardware.
Thorough experimental evaluation: six SLMs are used across both single and dual-agent settings. The authors evaluate not only task accuracy but also latency, memory usage, complexity of query, and token efficiency. The host of evaluation tasks give great confidence in the ability of dual-agent systems for superior on-device implementations.
Thoughtful error analysis: the error analysis is a super compelling contribution. The types of errors produced are very instructive into the failure modes of the two architectures. The fact that single agent systems were much more likely to have extra parameters further supports the assertion that dual-agent systems are the way to go.
Weaknesses:

Lack of comparison against larger LLMs: the evaluation is limited to SLMs. While I understand this design choice for on-device systems, it would be useful to benchmark against a similar cloud system. While the paper demonstrates that SLMs are capable of financial tool calling, it is unclear whether they are at the level of larger online systems or if usability is being sacrificed for privacy.
Limited scope of benchmark: The proposed benchmark is carefully constructed and well-suited for evaluating the ExpenseSense system, but its scope is narrow outside of that. The evaluation is only 115 question across five predefined tools, making it difficult to determine how well the reported results would generalize to more diverse tasks. Expanding the benchmark would improve its value to the privacy community.
Limited generalizability beyond personal finance: The paper focuses on a single privacy-sensitive application domain with a fixed set of tools. While a compelling example case, it would be very valuable to extend the results to a more general framework for any domain requiring private on-device inference (healthcare, legal, etc). It would be interesting to look at this in future work.
Overall, this was a well-executed systems paper addressing an important privacy-sensitive application. The paper states and thoroughly supports the assertion that a dual-agent architecture using SLMs can make an effective local financial assistant. The primary limitations concern the scope of evaluation and the breadth of the conclusions, which I view largely as opportunities for future work, not shortcomings of their analysis.

Rating: 7: Good paper, accept
Confidence: 4: The reviewer is confident but not absolutely certain that the evaluation is correct
Relevance To Haips: 5: Excellent fit for HAIPS; the paper is clearly central to the workshop's themes