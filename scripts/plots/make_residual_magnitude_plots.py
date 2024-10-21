# %%
import pandas as pd
from dash import Dash, dcc, html, dash_table
import plotly
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
import json
import os

data_dir = 'scripts/plots'
source_df = pd.read_csv(f'{data_dir}/fig2.csv')

# from https://colab.research.google.com/drive/1Z6AgGpPpnGY43DT58vl_Wvqmyw-KRfqY?usp=sharing#scrollTo=865d29bf
def line_plot(
    df: pd.DataFrame,
    log_y: bool = True,
    title: str = "Residual Stream Norm by Layer Number",
    color: str = "Prompt",
    legend_title_text: str = "Prompt",
) -> go.Figure:
    """Make a line plot of the RichPrompt norm. If log_y is True,
    adds a column to the dataframe with the log10 of the norm."""
    for col in ["Prompt", "Activation Location", "Magnitude"]:
        if col not in df.columns:
            raise ValueError(f"Column {col} not in dataframe")

    if log_y:
        df["LogMagnitude"] = np.log10(df["Magnitude"])

    fig = px.line(
        df,
        x="Activation Location",
        y="LogMagnitude" if log_y else "Magnitude",
        color=color,
        color_discrete_sequence=px.colors.sequential.Rainbow[::-1],
    )

    fig.update_layout(
        legend_title_text=legend_title_text,
        title=title,
        xaxis_title="Layer Number",
        yaxis_title=f"Norm{' (log 10)' if log_y else ''}",
    )
    return fig


def magnitude_histogram(df: pd.DataFrame, cols='all', title="Residual Stream Magnitude by Layer Number",
    xaxis_title="log10 Residual Stream norm", yaxis_title="Percentage of residual streams") -> go.Figure:
    """Plot a histogram of the residual stream magnitudes for each layer
    of the network."""
    if "Magnitude" not in df.columns:
        raise ValueError(f"Dataframe must have a 'Magnitude' column")

    # Get the number of unique activation locations
    num_unique_activation_locations = df["Activation Location"].nunique()

    # Generate a color list that is long enough to accommodate all unique activation locations
    extended_rainbow = (
        px.colors.sequential.Rainbow * num_unique_activation_locations
    )
    color_list = extended_rainbow[:num_unique_activation_locations][::-1]

    if cols != 'all':
        unique_cols = list(df["Activation Location"].unique())
        # get indices in unique_cols of values in cols
        cols_colors = [unique_cols.index(col) for col in cols]
        color_list = [color_list[i] for i in cols_colors]
        df = df[df["Activation Location"].isin(cols)]

    df["LogMagnitude"] = np.log10(df["Magnitude"])


    fig = px.histogram(
        df,
        x="LogMagnitude",
        color="Activation Location",
        marginal="rug",
        histnorm="percent",
        nbins=100,
        opacity=0.5,
        barmode="overlay",
        color_discrete_sequence=color_list,
    )

    fig.update_layout(
        legend_title_text="Before Layer Index",
        title=title,
        xaxis_title=xaxis_title,
        yaxis_title=yaxis_title,
    )

    return fig

model_name = "gpt2-xl"
figs:list[go.Figure] = []

df_magnitude_by_layer = pd.read_csv(f'{data_dir}/fig1.csv')
figs.append(magnitude_histogram(df_magnitude_by_layer))

for use_log in (True, False):
    single_fig = line_plot(
        source_df,
        log_y=use_log,
        title=f"Residual Stream Norm by Layer Number in {model_name}",
        color="Token",
        legend_title_text="Token"
    )
    single_fig.update_layout(width=600, height=450)
    figs.append(single_fig)

for single_fig in figs:
    single_fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font = dict(color = '#707080')
    )

post_name = 'residual_magnitude'

# make directory for post
os.makedirs(f'content/plots/{post_name}', exist_ok=True)

for i, single_fig in enumerate(figs):
    with open(f'content/plots/{post_name}/plot{i+1}.json', 'w') as f:
        plot_json = json.dumps(single_fig, cls=plotly.utils.PlotlyJSONEncoder)
        f.write(plot_json)

with open(f'{data_dir}/plot_template.js') as f:
    template = f.read()

with open(f"content/plots/{post_name}/load_plots.js", 'w') as f:
    f.write(template.replace('POSTNAME', post_name).replace('NUMPLOTS', str(len(figs))))