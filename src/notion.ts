import { Client, isFullBlock } from "@notionhq/client";
import type {
  BlockObjectResponse,
  CreatePageParameters,
  DataSourceObjectResponse,
  DatabaseObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";

import { collectImageCandidates } from "@/image";
import { RunLogger } from "@/logger";
import type {
  NotionBlockNode,
  NotionSourcePost,
  NotionStatus,
  ProjectLogPayload,
} from "@/types";
import { blocksToMarkdown } from "@/transform";

export function createNotionClient(apiKey: string): Client {
  return new Client({ auth: apiKey });
}

export async function fetchReadyPost(
  apiKey: string,
  databaseId: string,
  logger: RunLogger,
): Promise<NotionSourcePost | null> {
  const client = createNotionClient(apiKey);
  logger.info("Querying Notion database for Ready content");

  const database = (await client.databases.retrieve({
    database_id: databaseId,
  })) as DatabaseObjectResponse;

  const dataSourceId = database.data_sources[0]?.id;

  if (!dataSourceId) {
    throw new Error("Notion 데이터베이스에 연결된 data source를 찾지 못했습니다.");
  }

  const query = await client.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 1,
    filter: {
      property: "Status",
      status: {
        equals: "Ready",
      },
    },
    sorts: [
      {
        timestamp: "last_edited_time",
        direction: "ascending",
      },
    ],
  });

  const page = query.results.find(
    (result): result is PageObjectResponse =>
      result.object === "page" && "properties" in result && typeof result.properties === "object",
  );

  if (!page) {
    return null;
  }

  const blocks = await fetchBlockTree(client, page.id);
  const markdown = blocksToMarkdown(blocks);
  const imageCandidates = collectImageCandidates(blocks);

  return {
    pageId: page.id,
    title: getTitleProperty(page, "Title") || "Untitled",
    slug: getStringProperty(page, "Slug"),
    tags: getMultiSelectProperty(page, "Tags"),
    category: getSelectProperty(page, "Category"),
    blocks,
    markdown,
    imageCandidates,
  };
}

async function fetchBlockTree(client: Client, blockId: string): Promise<NotionBlockNode[]> {
  const results: NotionBlockNode[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const block of response.results) {
      if (!isFullBlock(block)) {
        continue;
      }

      const node = mapBlock(block);

      if (block.has_children) {
        node.children = await fetchBlockTree(client, block.id);
      }

      results.push(node);
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return results;
}

function mapBlock(block: BlockObjectResponse): NotionBlockNode {
  switch (block.type) {
    case "paragraph":
      return buildTextBlock(block, block.paragraph.rich_text);
    case "heading_1":
      return buildTextBlock(block, block.heading_1.rich_text);
    case "heading_2":
      return buildTextBlock(block, block.heading_2.rich_text);
    case "heading_3":
      return buildTextBlock(block, block.heading_3.rich_text);
    case "bulleted_list_item":
      return buildTextBlock(block, block.bulleted_list_item.rich_text);
    case "numbered_list_item":
      return buildTextBlock(block, block.numbered_list_item.rich_text);
    case "quote":
      return buildTextBlock(block, block.quote.rich_text);
    case "code":
      return {
        id: block.id,
        type: block.type,
        text: block.code.rich_text.map((item) => item.plain_text).join(""),
        language: block.code.language,
        hasChildren: block.has_children,
        children: [],
      };
    case "image": {
      const sourceType = block.image.type;
      const url = sourceType === "external" ? block.image.external.url : block.image.file.url;

      return {
        id: block.id,
        type: block.type,
        url,
        caption: block.image.caption.map((item) => item.plain_text).join(""),
        sourceType,
        hasChildren: block.has_children,
        children: [],
      };
    }
    default:
      return {
        id: block.id,
        type: block.type,
        text: readGenericBlockText(block),
        hasChildren: block.has_children,
        children: [],
      };
  }
}

function buildTextBlock(
  block: BlockObjectResponse,
  richText: RichTextItemResponse[],
): NotionBlockNode {
  return {
    id: block.id,
    type: block.type,
    text: richText.map((item) => item.plain_text).join(""),
    hasChildren: block.has_children,
    children: [],
  };
}

function readGenericBlockText(block: BlockObjectResponse): string {
  const value = (block as unknown as Record<string, unknown>)[block.type];
  if (!value || typeof value !== "object") {
    return "";
  }

  const richText = (value as { rich_text?: RichTextItemResponse[] }).rich_text;
  return richText?.map((item) => item.plain_text).join("") ?? "";
}

export async function updatePostStatus(options: {
  apiKey: string;
  pageId: string;
  status: NotionStatus;
  publishedAt?: string;
  errorLog?: string;
  tistoryUrl?: string;
  xPostId?: string;
  thumbnailPath?: string;
  thumbnailPrompt?: string;
}) {
  const client = createNotionClient(options.apiKey);
  const properties: UpdatePageParameters["properties"] = {
    Status: {
      select: {
        name: options.status,
      },
    },
  };

  if (options.publishedAt) {
    properties.PublishedAt = {
      date: {
        start: options.publishedAt,
      },
    };
  }

  if (options.errorLog !== undefined) {
    properties.ErrorLog = {
      rich_text: [
        {
          type: "text",
          text: {
            content: options.errorLog,
          },
        },
      ],
    };
  }

  if (options.tistoryUrl !== undefined) {
    properties.TistoryUrl = {
      url: options.tistoryUrl || null,
    };
  }

  if (options.xPostId !== undefined) {
    properties.XPostId = {
      rich_text: options.xPostId
        ? [
            {
              type: "text",
              text: {
                content: options.xPostId,
              },
            },
          ]
        : [],
    };
  }

  if (options.thumbnailPath !== undefined) {
    properties.ThumbnailPath = {
      rich_text: options.thumbnailPath
        ? [
            {
              type: "text",
              text: {
                content: options.thumbnailPath,
              },
            },
          ]
        : [],
    };
  }

  if (options.thumbnailPrompt !== undefined) {
    properties.ThumbnailPrompt = {
      rich_text: options.thumbnailPrompt
        ? [
            {
              type: "text",
              text: {
                content: options.thumbnailPrompt,
              },
            },
          ]
        : [],
    };
  }

  await client.pages.update({
    page_id: options.pageId,
    properties,
  });
}

export async function appendProjectLog(
  apiKey: string,
  databaseId: string,
  payload: ProjectLogPayload,
): Promise<void> {
  const client = createNotionClient(apiKey);
  const database = (await client.databases.retrieve({
    database_id: databaseId,
  })) as DatabaseObjectResponse;
  const dataSourceId = database.data_sources[0]?.id;

  if (!dataSourceId) {
    throw new Error("프로젝트 로그 DB에 연결된 data source를 찾지 못했습니다.");
  }

  const dataSource = (await client.dataSources.retrieve({
    data_source_id: dataSourceId,
  })) as DataSourceObjectResponse;

  const titleProperty = Object.entries(dataSource.properties).find(([, property]) => property.type === "title")?.[0];
  const dateProperty = Object.entries(dataSource.properties).find(([, property]) => property.type === "date")?.[0];

  if (!titleProperty) {
    throw new Error("프로젝트 로그 DB에 title 속성이 필요합니다.");
  }

  const properties: CreatePageParameters["properties"] = {
    [titleProperty]: {
      title: [
        {
          type: "text",
          text: {
            content: payload.title,
          },
        },
      ],
    },
  };

  if (dateProperty) {
    properties[dateProperty] = {
      date: {
        start: payload.date,
      },
    };
  }

  await client.pages.create({
    parent: {
      data_source_id: dataSourceId,
    },
    properties,
    children: buildLogChildren(payload),
  });
}

function buildLogChildren(payload: ProjectLogPayload) {
  return [
    headingBlock("오늘 한 일"),
    paragraphBlock(payload.today),
    headingBlock("구현 내용"),
    paragraphBlock(payload.implementation),
    headingBlock("문제점"),
    paragraphBlock(payload.problems),
    headingBlock("해결 방법"),
    paragraphBlock(payload.resolutions),
    headingBlock("다음 할 일"),
    paragraphBlock(payload.next),
  ];
}

function headingBlock(text: string) {
  return {
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function paragraphBlock(text: string) {
  return {
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [{ type: "text" as const, text: { content: text } }],
    },
  };
}

function getTitleProperty(page: PageObjectResponse, propertyName: string): string {
  const property = page.properties[propertyName];
  if (!property || property.type !== "title") {
    return "";
  }

  return property.title.map((item) => item.plain_text).join("");
}

function getStringProperty(page: PageObjectResponse, propertyName: string): string | undefined {
  const property = page.properties[propertyName];
  if (!property) {
    return undefined;
  }

  switch (property.type) {
    case "rich_text":
      return property.rich_text.map((item) => item.plain_text).join("") || undefined;
    case "url":
      return property.url ?? undefined;
    case "formula":
      return property.formula.type === "string" ? property.formula.string ?? undefined : undefined;
    default:
      return undefined;
  }
}

function getSelectProperty(page: PageObjectResponse, propertyName: string): string | undefined {
  const property = page.properties[propertyName];
  if (!property || property.type !== "select") {
    return undefined;
  }

  return property.select?.name ?? undefined;
}

function getMultiSelectProperty(page: PageObjectResponse, propertyName: string): string[] {
  const property = page.properties[propertyName];
  if (!property || property.type !== "multi_select") {
    return [];
  }

  return property.multi_select.map((item) => item.name);
}
