from llama_cpp import Llama
from llama_cpp.llama_chat_format import Jinja2ChatFormatter, ChatFormatterResponse
from typing import Any

llm = Llama(model_path='models/minicpm5-1b-Q8_0.gguf', n_gpu_layers=0, verbose=False)

# Get the original template
template = llm.metadata.get('tokenizer.chat_template')
eos_token = llm._model.token_get_text(llm.token_eos())
bos_token = llm._model.token_get_text(llm.token_bos())

class CustomFormatter(Jinja2ChatFormatter):
    def __call__(self, **kwargs) -> ChatFormatterResponse:
        kwargs["enable_thinking"] = False
        return super().__call__(**kwargs)

formatter = CustomFormatter(template=template, eos_token=eos_token, bos_token=bos_token)
llm.chat_handler = formatter

response = llm.create_chat_completion([{'role': 'user', 'content': 'What is 2+2? Answer strictly in one word.'}], max_tokens=20)
print("OUTPUT:")
print(response['choices'][0]['message']['content'])
