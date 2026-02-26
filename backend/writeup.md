# Asking My Data: How I Built a Local AI Finance Assistant on an 8GB Mac (and cut my snack spending by 30%)

Ever since I started living independently, I’ve been manually logging all my expenses in an Excel sheet. My dad originally recommended I do this, and while I *could* automate importing the data from my bank, I found that the manual logging process forced me to actually look at my past expenses and become much more cognizant of my spending habits (the next time i spend, I am reminded of the manually logged transactions in the excel). 

The Excel sheet eventually grew exhaustive. To track where my money was going, I built a personal web app with static dashboards and metrics. The visual insights were great for understanding the overall pull on my liquidity and making decisions about discretionary spending like sports merch (Kobe merch to be precise). 

But I quickly realized that static dashboards can’t answer very particular questions like:
- *"Compare expenses on groceries for Jan 2024 vs Jan 2025"* (to see YoY increases)
- *"Plot spending on dining for the past 6 months"* (to see how much I spend on eating out)
- *"Get me a breakdown on spending for education for 2025"* 

I wanted to add a feature where I could just *ask* my data these questions and have an LLM spit out the answer. Firing off API calls to Gemini or OpenAI or Anthropic would have been the easiest route, but where's the fun in that? Plus, spending money on API calls to figure out how to *save* money felt kinda ironic.

So, I decided to make it work completely **locally** on my 6-year-old Mac M1 with only 8GB of RAM. This meant I had to limit my scope to small, efficient LLMs with 3 billion parameters or fewer.

## Building the Pipeline: Three Iterations

Getting an LLM to reliably query a personal database isn't as straightforward as it seems. Here is how the architecture evolved:

**1. The Code Generation Approach**
My first instinct was to have local LLMs simply write Python code to answer the questions based on user input. 
*The problem:* Inference took way too long because I had to cram my entire database schema and context into the prompt, and the generated code was often hallucinated or immediately threw syntax errors.

**2. The Single-Step Tool Calling Approach**
Next, I pivoted to giving the LLM predefined "tools" (e.g., a function to plot data over a specific period, a function to compare two periods, etc.). 
*The problem:* While execution accuracy improved, the input prompt was still massive because I had to supply all the tool definitions upfront, which bogged down the tiny models and choked performance.

**3. The Multi-Agent Workflow**
Finally, I designed a multi-stage **Router -> Specialist -> Summarizer** pipeline:
1. **Router**: Receives the user’s question and strictly decides *which* tool to call.
2. **Specialist**: Receives the chosen tool and the user's question, then extracts the exact arguments needed (like time periods and spending categories). 
3. **Summarizer** *(optional)*: Takes the data output from the tool and generates a clean, conversational answer.

**Handling LLM Quirks: The Input Validation Layer**
Even with the multi-agent setup, I quickly noticed that small LLMs aren't perfect string-matchers. If my database had a category named "Food," the Specialist might extract "food," "Food," or even append trailing whitespace. A strict programmatic database query would fail immediately on these minor discrepancies.

To fix this, I had to introduce a robust validation layer inside `analysis_tools.py`. By implementing fuzzy string matching and case-insensitive validators, the backend actively catches these tiny LLM hallucinations and corrects them (mapping "food" to "Food") *before* the script crashes. This massively improved the reliability of the 0.6B and 1.7B parameter models, allowing them to punch way above their weight class.

This approach was a massive success! Using Ollama, my pipeline latency dropped to around 20–30 seconds. However, I still wanted that snappy, instant-chat feel.

## Enter Apple MLX: Pushing Hardware Limits

To speed up inference, I stripped out Ollama and integrated Apple's native **MLX** framework, which is tailor-made for Apple Silicon. **The result? Total pipeline time plummeted to 10-15 seconds.**

With the infrastructure humming, I ran extensive benchmarks using my pipeline against several highly capable small models—most notably IBM's Granite-4.0 and Alibaba's impressive Qwen-/3 series. 

### The Methodology: How Do We Actually Measure "Good"?
Before looking at the numbers, it’s important to understand *how* the pipeline is evaluated. Because this isn't a simple "generate text" task, standard LLM benchmarks don't apply. I wrote a comprehensive testing script (`benchmark_mlx.py`) that throws 20 distinct, complex queries at the pipeline, running each 5 times to account for generation variance. 

The benchmark evaluates **Latency** (how fast the pipeline completes) against a custom **Composite Accuracy** metric. 

Composite Accuracy is a weighted score out of 100% that strictly evaluates if the model did its job at every stage:
1. **Router Accuracy (30% weight)**: Did the first model pick the exact right tool for the job?
2. **Function Output (50% weight)**: Did the specialist model format the final Python regex correctly? (e.g., `plot_time_series(df, ...)`). 
3. **Parameter Extraction (20% weight)**: Did the specialist extract all the required parameters? (e.g., pulling "snacks" instead of "food", or accurately parsing "Jan 2025" into `y=2025, m=1`). 

**An Example Breakdown:**
If I ask: *"Compare spending on grocery 2025 Jan vs 2026 Jan"*
- The **Router** must output exactly: `plot_comparison_bars`
- The **Specialist** must output the exact strings: `category="grocery"`, `y1=2025`, `m1=1`, `y2=2026`, `m2=1`. 
If a model hallucinates a parameter or gets the syntax wrong, its score for that specific run drops.

### The Results: Battle of the Small Models
Before diving into the granular metrics, the **Summary Panel** below provides a high-level overview of the performance landscape across all tested models:

![Summary Panel](figures/summary_panel.png)

Focusing on the core speed-vs-quality tradeoff, here is the accuracy vs. latency scatterplot:

![Accuracy vs Latency](figures/acc_vs_latency.png)

The tradeoff between quantized bit-rates and parameter sizes became incredibly clear. 

**The Heavyweight Champ: Qwen3 1.7B (4-bit)**
I was absolutely blown away by Alibaba's **Qwen3 1.7B**. Running natively via MLX, the 4-bit quantization achieved a staggering **97.5% Composite Accuracy** across all complex user query combinations, wrapping up the entire multi-stage pipeline in an average of **4.79 seconds**.

For a smooth chat UX, average latency doesn't tell the whole story—consistency across executions is equally important.

![Latency Box Plot](figures/latency_box.png)

The latency distribution above confirms that Qwen3 1.7B operates in a tight, predictable window without frustrating outliers. So where is that 4.79 seconds actually being spent?

![Latency Breakdown](figures/latency_breakdown.png)

Looking at the latency breakdown above, you can see how the multi-agent design distributes the load. The Router and Specialist (which do the heavy lifting of reasoning) take up the bulk of the time, while the Summarizer is incredibly fast.

**The Lightweight Speed Demon: Qwen3 0.6B (8-bit)**
If you are completely starved for RAM, the **0.6B 8-bit** model is absurdly efficient. It executes the entire pipeline in **2.1 seconds** while maintaining a highly respectable **81.8% accuracy**. 

While the top-line accuracy numbers are impressive, it's illuminating to look at *where* exactly the models hit their ceiling across different query types (Time-Series, Comparisons, Stats).

![Category Heatmap](figures/category_heatmap.png)

The heatmap reveals that extracting arguments for complex tools—like multi-layered "Statistics" or specific "Comparisons"—is what separates the good models from the great ones. The 0.6B model struggles significantly more on these nuanced tasks compared to basic retrieval.

You can see how effectively these specific models navigate the complex array of tasks in the detailed accuracy breakdown plot below (comparing Router accuracy vs. specific Parameter extraction accuracy):

![Accuracy Breakdown](figures/accuracy_breakdown.png)

## Real-World Impact: The 30% Snack Cut

Building your own software is cool, but applying it to improve your personal life is even better. 

Once the MLX pipeline was fully integrated, I tested the chat interface by asking it: *"Plot my spendings on snacks for the past 6 months."*

![Spending on Snacks Video](figures/snacks_ask.mov)

The dynamically generated Plotly chart it returned was a serious wake-up call. I realized my discretionary snack spending had spiked aggressively. Resolving to improve my dietary habits, I used the stark visual as motivation.

I instituted a "commitment device"—placing a bet with a Uni friend about who could go completely sugarless for the longest time. Thanks to the frictionless ability to literally just "ask my data" about my habits, **I have successfully reduced my snack spending by over 30%** (comparing Dec 2025 to Jan 2026).

It's been an incredibly rewarding project. I inadvertently learned the intricacies of small parameter models like Granite-4 and Qwen3, drastically sped up my Mac M1's inference with MLX, and built a deeply personal, privacy-first tool that is visibly improving my health and my wallet. 

The ability to ask your own local data questions and securely get answers in seconds is, I believe, what the future of personal computing looks like.