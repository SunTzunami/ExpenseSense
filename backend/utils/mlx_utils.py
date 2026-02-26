import os
import glob
import logging
from mlx_lm import load, generate

logger = logging.getLogger(__name__)

class MLXModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLXModel, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.tokenizer = None
            cls._instance.current_model_path = None
        return cls._instance

    def resolve_path(self, model_identifier: str):
        """Resolves a model identifier to an absolute path, checking LM Studio first."""
        if os.path.exists(model_identifier):
            return model_identifier
            
        lm_studio_base = os.path.expanduser("~/.lmstudio/models")
        if os.path.exists(lm_studio_base):
            # Check if it's a publisher/model format
            potential_path = os.path.join(lm_studio_base, model_identifier)
            if os.path.exists(potential_path) and os.path.isdir(potential_path):
                return potential_path
        
        # If not found in LM Studio, assume it's a HF repo ID and let mlx_lm handle it
        return model_identifier

    def load_model(self, model_identifier: str):
        """Loads the MLX model and tokenizer if not already loaded."""
        model_path = self.resolve_path(model_identifier)
        
        if self.current_model_path == model_path and self.model is not None:
            return

        logger.info(f"Loading MLX model from: {model_path} (Identified as: {model_identifier})")
        try:
            self.model, self.tokenizer = load(model_path)
            self.current_model_path = model_path
            logger.info("MLX model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load MLX model: {e}")
            raise e

    def generate(self, model_identifier: str, prompt: str, max_tokens: int = 500, temperature: float = 0.0):
        """Generates text using the MLX model."""
        self.load_model(model_identifier)
        
        try:
            from mlx_lm.sample_utils import make_sampler
            sampler = make_sampler(temp=temperature)
            
            # mlx-lm generate function
            response = generate(
                self.model, 
                self.tokenizer, 
                prompt=prompt, 
                max_tokens=max_tokens,
                sampler=sampler,
                verbose=False
            )
            return response
        except ImportError:
            # Fallback for older mlx-lm versions
            logger.info("make_sampler not found, falling back to temp parameter.")
            return generate(
                self.model, 
                self.tokenizer, 
                prompt=prompt, 
                max_tokens=max_tokens,
                temp=temperature,
                verbose=False
            )
        except Exception as e:
            logger.error(f"MLX generation error: {e}")
            return f"Error: {str(e)}"

    def chat(self, model_identifier: str, messages: list, max_tokens: int = 500, temperature: float = 0.0):
        """Formats messages and generates code/text."""
        try:
            self.load_model(model_identifier)
            if hasattr(self.tokenizer, "apply_chat_template"):
                try:
                    # Try with enable_thinking=False for models that support it (e.g. Qwen3)
                    prompt = self.tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True, enable_thinking=False
                    ) #enable thinking is disabled for qwen3
                except TypeError:
                    # Fallback for tokenizers that don't support enable_thinking
                    prompt = self.tokenizer.apply_chat_template(
                        messages, tokenize=False, add_generation_prompt=True
                    )
            else:
                prompt = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages]) + "\nASSISTANT: "
            
            return self.generate(model_identifier, prompt, max_tokens, temperature)
        except Exception as e:
            logger.error(f"MLX chat error: {e}")
            return f"Error: {str(e)}"

    def list_available_models(self):
        """Lists available MLX models in HF and LM Studio caches, filtering out TTS models."""
        search_paths = [
            os.path.expanduser("~/.cache/huggingface/hub"),
            os.path.expanduser("~/.lmstudio/models")
        ]
        
        models = []
        exclude_keywords = ["-tts-", "-voice-", "pitched-", "vocos"]
        
        for base_path in search_paths:
            if not os.path.exists(base_path):
                continue
                
            if "huggingface" in base_path:
                # Standard HF Cache
                paths = glob.glob(os.path.join(base_path, "models--*mlx*"))
                for path in paths:
                    folder_name = os.path.basename(path).lower()
                    if any(k in folder_name for k in exclude_keywords):
                        continue
                    parts = os.path.basename(path).split("--")
                    if len(parts) >= 3:
                        repo = f"{parts[1]}/{parts[2]}"
                        models.append(repo)
            else:
                # LM Studio Cache (structure: publisher/model_name)
                for publisher in os.listdir(base_path):
                    if publisher.startswith('.'): continue
                    pub_path = os.path.join(base_path, publisher)
                    if not os.path.isdir(pub_path): continue
                    
                    for model_folder in os.listdir(pub_path):
                        if model_folder.startswith('.'): continue
                        full_path = os.path.join(pub_path, model_folder)
                        
                        if not os.path.isdir(full_path): continue
                        
                        # Look for MLX models (either folder or publisher has 'mlx' and contains config.json)
                        # We also skip GGUF models explicitly
                        is_mlx = "mlx" in model_folder.lower() or "mlx" in publisher.lower()
                        has_config = os.path.exists(os.path.join(full_path, "config.json"))
                        is_gguf = any(f.endswith(".gguf") for f in os.listdir(full_path))
                        
                        if is_mlx and has_config and not is_gguf:
                            if any(k in model_folder.lower() for k in exclude_keywords):
                                continue
                            # Return publisher/model_name for cleaner UI
                            models.append(f"{publisher}/{model_folder}")
                        
                        # Handle deeper nesting if it's another directory level
                        # some providers use publisher/category/model
                        elif os.path.isdir(full_path):
                            for sub_folder in os.listdir(full_path):
                                if sub_folder.startswith('.'): continue
                                sub_path = os.path.join(full_path, sub_folder)
                                if os.path.isdir(sub_path) and os.path.exists(os.path.join(sub_path, "config.json")):
                                    if "mlx" in sub_folder.lower() or "mlx" in publisher.lower():
                                        if not any(k in sub_folder.lower() for k in exclude_keywords):
                                            models.append(f"{publisher}/{model_folder}/{sub_folder}")

        # Deduplicate and sort
        return sorted(list(set(models)))

mlx_model = MLXModel()
