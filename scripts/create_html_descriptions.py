"""
This script creates HTML descriptions for blog posts by generating them using
the Gemini 1.5 Pro model from Google Generative AI.

It reads the content of each Markdown file, extracts the YAML front matter, and if no description is found, generates one.
The generated description is then saved back to the file.
"""

import os
import re
from pathlib import Path
import yaml
import google.generativeai as genai  # type: ignore[import]

import scripts.utils as script_utils

# Configure the Gemini API (you'll need to set up your API key)
genai.configure(api_key="YOUR_API_KEY_HERE")


def get_gemini_description(content: str) -> str:
    """
    Generate a description for a blog post using the Gemini 1.5 Pro model.
    """
    model = genai.GenerativeModel("gemini-1.5-pro")
    prompt = f"""
    Based on the following content, write a concise description for a blog post. 
    The description should be engaging, accurate, and between 150-160 characters long.
    
    Content:
    {content[:1000]}  # Limiting to first 1000 characters for brevity
    """
    response = model.generate_content(prompt)
    return response.text


def process_file(file_path: Path) -> None:
    """
    Process a single file, extract YAML front matter, generate a description if needed, and update the file.
    """
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    # Extract YAML front matter
    yaml_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if yaml_match:
        yaml_content = yaml_match.group(1)
        data = yaml.safe_load(yaml_content)

        if "description" not in data or not data["description"]:
            print(f"No description found in {file_path}. Generating one...")

            while True:
                generated_description = get_gemini_description(content)
                print(f"Generated description: {generated_description}")

                user_input = input(
                    "Accept this description? (yes/no): "
                ).lower()
                if user_input == "yes":
                    data["description"] = generated_description
                    break
                elif user_input == "no":
                    print("Generating a new description...")
                else:
                    print("Invalid input. Please enter 'yes' or 'no'.")

            # Update the file with the new YAML front matter
            updated_yaml = yaml.dump(data, allow_unicode=True)
            updated_content = re.sub(
                r"^---\n.*?\n---",
                f"---\n{updated_yaml}---",
                content,
                flags=re.DOTALL,
            )

            with open(file_path, "w", encoding="utf-8") as file:
                file.write(updated_content)

            print(f"Updated {file_path} with new description.")
        else:
            print(f"Description already exists in {file_path}. Skipping.")
    else:
        print(f"No YAML front matter found in {file_path}. Skipping.")


def main() -> None:
    """
    Main function to process all Markdown files in the current directory.
    """
    git_root = script_utils.get_git_root()
    if git_root is None:
        raise RuntimeError("Could not find git root")
    directory = git_root / "content"
    for filename in os.listdir(directory):
        if filename.endswith(".md"):
            file_path = os.path.join(directory, filename)
            process_file(Path(file_path))


if __name__ == "__main__":
    main()
