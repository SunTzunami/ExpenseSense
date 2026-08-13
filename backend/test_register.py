from llama_cpp import Llama
import llama_cpp.llama_chat_format as llama_chat_format

@llama_chat_format.register_chat_format("minicpm-no-think")
def format_minicpm_no_think(messages, **kwargs):
    # This is a custom formatter that forces the <think> closure
    prompt = ""
    for m in messages:
        prompt += f"<|im_start|>{m['role']}\n{m['content']}<|im_end|>\n"
    prompt += "<|im_start|>assistant\n<think>\n\n</think>\n\n"
    return llama_chat_format.ChatFormatterResponse(prompt=prompt, stop=["<|im_end|>"])

llm = Llama(model_path='models/minicpm5-1b-Q8_0.gguf', n_gpu_layers=0, verbose=False, chat_format="minicpm-no-think")
response = llm.create_chat_completion([{'role': 'user', 'content': 'What is 2+2? Answer strictly in one word.'}], max_tokens=20)
print("OUTPUT:")
print(response['choices'][0]['message']['content'])
